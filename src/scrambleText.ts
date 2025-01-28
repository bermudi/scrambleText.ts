export interface ScrambleTextConfig {
    text: string;
    chars?: string;
    duration?: number;
    speed?: number;
    delay?: number;
    rightToLeft?: boolean;
    preserveOriginal?: boolean;
    ease?: (t: number) => number;
    iteration?: 'once' | 'loop' | 'reverse' | 'alternate';
    customRandom?: (index: number, originalChar: string) => string;
    threshold?: number;
}

const defaultChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const defaultThreshold = 0.1;

export const scrambleText = (
    element: HTMLElement,
    config: ScrambleTextConfig
): (() => void) => {
    const {
        text: finalText,
        chars = defaultChars,
        duration = 2000,
        speed = 50,
        delay = 0,
        rightToLeft = false,
        preserveOriginal = false,
        ease,
        iteration = 'once',
        customRandom,
        threshold = defaultThreshold
    } = config;

    let frame: number;
    let startTime: number | null = null;
    let isInDelayPhase = true;
    let delayStartTime: number | null = null;
    let direction: 1 | -1 = 1;
    let iterationCount = 0;

    const getRandomChar = () => chars[Math.floor(Math.random() * chars.length)];

    const getScrambledText = () => {
        const scrambled = [];
        for (let i = 0; i < finalText.length; i++) {
            const originalChar = finalText[i];
            if (preserveOriginal && !chars.includes(originalChar)) {
                scrambled.push(originalChar);
            } else if (customRandom) {
                scrambled.push(customRandom(i, originalChar));
            } else {
                scrambled.push(getRandomChar());
            }
        }
        return scrambled.join('');
    };

    const updateText = (progress: number) => {
        const targetLength = finalText.length;
        const currentLength = Math.ceil(targetLength * progress);
        const scrambled = [];

        for (let i = 0; i < targetLength; i++) {
            const originalChar = finalText[i];
            const shouldReveal = rightToLeft 
                ? i >= targetLength - currentLength
                : i < currentLength;

            if (preserveOriginal && !chars.includes(originalChar)) {
                scrambled.push(originalChar);
            } else if (shouldReveal) {
                scrambled.push(originalChar);
            } else if (customRandom) {
                scrambled.push(customRandom(i, originalChar));
            } else {
                scrambled.push(getRandomChar());
            }
        }

        element.textContent = scrambled.join('');
    };

    const animate = (timestamp: number) => {
        if (!delayStartTime) {
            delayStartTime = timestamp;
            element.textContent = getScrambledText();
        }

        if (isInDelayPhase) {
            const delayElapsed = timestamp - delayStartTime;
            if (delayElapsed < delay) {
                element.textContent = getScrambledText();
                frame = requestAnimationFrame(animate);
                return;
            }
            isInDelayPhase = false;
            startTime = timestamp;
        }

        const elapsed = timestamp - (startTime || 0);
        let progress = Math.min(elapsed / duration, 1);
        progress = direction === 1 ? progress : 1 - progress;
        const easedProgress = ease ? ease(progress) : progress;

        if (progress < 1) {
            updateText(easedProgress);
            frame = requestAnimationFrame(animate);
        } else {
            switch (iteration) {
                case 'loop':
                    startTime = timestamp;
                    frame = requestAnimationFrame(animate);
                    break;
                case 'reverse':
                    direction *= -1;
                    startTime = timestamp;
                    frame = requestAnimationFrame(animate);
                    break;
                case 'alternate':
                    direction *= -1;
                    iterationCount++;
                    startTime = timestamp;
                    frame = requestAnimationFrame(animate);
                    break;
                default:
                    element.textContent = finalText;
            }
        }
    };

    frame = requestAnimationFrame(animate);

    return () => {
        cancelAnimationFrame(frame);
        element.textContent = finalText;
    };
};

// Enhanced React Hook with Intersection Observer
import { useEffect, useRef, useState } from 'react';

export const useScrambleText = <T extends HTMLElement>(
    text: string,
    config?: Omit<ScrambleTextConfig, 'text' | 'threshold'>
) => {
    const elementRef = useRef<T | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);
    const [isInView, setIsInView] = useState(false);
    const threshold = config?.threshold ?? defaultThreshold;

    useEffect(() => {
        if (!elementRef.current) return;

        const observer = new IntersectionObserver(
            ([entry]) => setIsInView(entry.isIntersecting),
            { threshold }
        );

        observer.observe(elementRef.current);
        return () => observer.disconnect();
    }, [threshold]);

    useEffect(() => {
        if (elementRef.current && isInView) {
            cleanupRef.current?.();
            cleanupRef.current = scrambleText(elementRef.current, {
                text,
                ...config
            });
        }
        return () => cleanupRef.current?.();
    }, [text, config, isInView]);

    return elementRef;
};
