export interface ScrambleTextConfig {
    text: string;
    chars?: string;
    duration?: number;
    speed?: number;
    delay?: number;
    inView?: boolean;
    rightToLeft?: boolean;
}

const defaultChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const scrambleText = (
    element: HTMLElement,
    config: ScrambleTextConfig
): () => void => {
    const finalText = config.text;
    const duration = config.duration ?? 2000;
    const speed = config.speed ?? 50;
    const delay = config.delay ?? 0;
    const chars = config.chars ?? defaultChars;
    const inView = config.inView ?? true;
    const rightToLeft = config.rightToLeft ?? false;

    let frame: number;
    let startTime: number | null = null;
    let isInDelayPhase = true;
    let delayStartTime: number | null = null;

    const getRandomChar = () => chars[Math.floor(Math.random() * chars.length)];

    const getScrambledText = () => {
        let result = '';
        for (let i = 0; i < finalText.length; i++) {
            result += getRandomChar();
        }
        return result;
    };

    const updateText = (progress: number) => {
        const targetLength = finalText.length;
        const currentLength = Math.ceil(targetLength * progress);

        let result = '';
        if (rightToLeft) {
            // For right-to-left, reveal from the end
            for (let i = 0; i < targetLength; i++) {
                if (i >= targetLength - currentLength) {
                    result += finalText[i];
                } else {
                    result += getRandomChar();
                }
            }
        } else {
            // For left-to-right, reveal from the start
            for (let i = 0; i < targetLength; i++) {
                if (i < currentLength) {
                    result += finalText[i];
                } else {
                    result += getRandomChar();
                }
            }
        }

        element.textContent = result;
    };

    const animate = (timestamp: number) => {
        if (!inView) {
            element.textContent = '';
            return;
        }

        if (!delayStartTime) {
            delayStartTime = timestamp;
            element.textContent = getScrambledText();
        }

        if (isInDelayPhase) {
            const delayElapsed = timestamp - delayStartTime;
            if (delayElapsed < delay) {
                // During delay, keep showing scrambled text
                element.textContent = getScrambledText();
                frame = requestAnimationFrame(animate);
                return;
            }
            isInDelayPhase = false;
            startTime = timestamp;
        }

        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);

        if (progress < 1) {
            updateText(progress);
            frame = requestAnimationFrame(animate);
        } else {
            element.textContent = finalText;
        }
    };

    if (inView) {
        frame = requestAnimationFrame(animate);
    }

    // Return cleanup function
    return () => {
        if (frame) {
            cancelAnimationFrame(frame);
        }
    };
};

// React hook for scrambleText
import { useEffect, useRef } from 'react';

export const useScrambleText = <T extends HTMLElement>(
    text: string,
    config?: Omit<ScrambleTextConfig, 'text'>
) => {
    const elementRef = useRef<T | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (elementRef.current) {
            if (cleanupRef.current) {
                cleanupRef.current();
            }
            cleanupRef.current = scrambleText(elementRef.current, {
                text,
                ...config
            });
        }
        return () => {
            if (cleanupRef.current) {
                cleanupRef.current();
            }
        };
    }, [text, config]);

    return elementRef;
}; 
