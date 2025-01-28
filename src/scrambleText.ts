// Types and interfaces
type IterationMode = 'once' | 'loop' | 'reverse' | 'alternate';

interface AnimationState {
    direction: 1 | -1;
    iterationCount: number;
    frame: number | null;
    startTime: number | null;
    delayStartTime: number | null;
    isInDelayPhase: boolean;
}

export interface ScrambleTextConfig {
    text: string;
    chars?: string;
    duration?: number;
    speed?: number;
    delay?: number;
    inView?: boolean;
    rightToLeft?: boolean;
    ease?: (t: number) => number;
    preserveOriginal?: boolean;
    iteration?: IterationMode;
    customRandom?: (index: number, originalChar: string) => string;
}

const defaultChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Easing functions
const easings = {
    linear: (t: number) => t,
    easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
    easeInOutCubic: (t: number) => 
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
};

export const scrambleText = (
    element: HTMLElement,
    config: ScrambleTextConfig
): () => void => {
    const {
        text: finalText,
        duration = 2000,
        speed = 50,
        delay = 0,
        chars = defaultChars,
        inView = true,
        rightToLeft = false,
        ease = easings.easeOutCubic,
        preserveOriginal = true,
        iteration = 'once',
        customRandom
    } = config;

    const state: AnimationState = {
        direction: 1,
        iterationCount: 0,
        frame: null,
        startTime: null,
        delayStartTime: null,
        isInDelayPhase: true
    };

    // Pre-compute text properties
    const textLength = finalText.length;
    const charSet = new Set(chars);

    const getRandomChar = (index: number, originalChar: string): string => {
        if (customRandom) {
            return customRandom(index, originalChar);
        }
        return chars[Math.floor(Math.random() * chars.length)];
    };

    const getScrambledText = (): string => {
        const scrambled = new Array(textLength);
        for (let i = 0; i < textLength; i++) {
            const originalChar = finalText[i];
            if (preserveOriginal && !charSet.has(originalChar)) {
                scrambled[i] = originalChar;
            } else {
                scrambled[i] = getRandomChar(i, originalChar);
            }
        }
        return scrambled.join('');
    };

    const updateText = (progress: number): void => {
        const currentLength = Math.ceil(textLength * progress);
        const scrambled = new Array(textLength);

        for (let i = 0; i < textLength; i++) {
            const originalChar = finalText[i];
            if (preserveOriginal && !charSet.has(originalChar)) {
                scrambled[i] = originalChar;
            } else if (rightToLeft ? i >= textLength - currentLength : i < currentLength) {
                scrambled[i] = finalText[i];
            } else {
                scrambled[i] = getRandomChar(i, originalChar);
            }
        }

        element.textContent = scrambled.join('');
    };

    const handleIteration = (timestamp: number): void => {
        switch (iteration) {
            case 'loop':
                state.startTime = timestamp;
                state.frame = requestAnimationFrame(animate);
                break;
            case 'reverse':
            case 'alternate':
                state.direction *= -1;
                state.startTime = timestamp;
                state.frame = requestAnimationFrame(animate);
                break;
            default:
                element.textContent = finalText;
        }
    };

    const animate = (timestamp: number): void => {
        if (!inView) {
            element.textContent = finalText;
            return;
        }

        if (!state.delayStartTime) {
            state.delayStartTime = timestamp;
            element.textContent = getScrambledText();
        }

        if (state.isInDelayPhase) {
            const delayElapsed = timestamp - state.delayStartTime;
            if (delayElapsed < delay) {
                element.textContent = getScrambledText();
                state.frame = requestAnimationFrame(animate);
                return;
            }
            state.isInDelayPhase = false;
            state.startTime = timestamp;
        }

        const elapsed = timestamp - state.startTime;
        const rawProgress = Math.min(elapsed / duration, 1);
        const progress = state.direction === 1 ? rawProgress : 1 - rawProgress;
        const easedProgress = ease(progress);

        if ((state.direction === 1 && rawProgress >= 1) || 
            (state.direction === -1 && rawProgress <= 0)) {
            handleIteration(timestamp);
        } else {
            updateText(easedProgress);
            state.frame = requestAnimationFrame(animate);
        }
    };

    if (inView) {
        state.frame = requestAnimationFrame(animate);
    }

    return () => {
        if (state.frame) {
            cancelAnimationFrame(state.frame);
        }
    };
};

// React hook with Intersection Observer
import { useEffect, useRef, useState } from 'react';

export const useScrambleText = <T extends HTMLElement>(
    text: string,
    config?: Omit<ScrambleTextConfig, 'text' | 'inView'>
) => {
    const elementRef = useRef<T | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);
    const [isInView, setIsInView] = useState(false);
    const [hasAnimated, setHasAnimated] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !hasAnimated) {
                        setIsInView(true);
                        setHasAnimated(true);
                    }
                });
            },
            { threshold: 0.1 }
        );

        if (elementRef.current) {
            observer.observe(elementRef.current);
        }

        return () => observer.disconnect();
    }, [hasAnimated]);

    useEffect(() => {
        if (elementRef.current) {
            if (cleanupRef.current) {
                cleanupRef.current();
            }
            cleanupRef.current = scrambleText(elementRef.current, {
                text,
                ...config,
                inView: isInView
            });
        }

        return () => {
            if (cleanupRef.current) {
                cleanupRef.current();
            }
        };
    }, [text, config, isInView]);

    return elementRef;
};
