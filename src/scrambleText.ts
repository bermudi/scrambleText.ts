import { useEffect, useRef } from "react";

export interface ScrambleTextConfig {
    text: string;
    chars?: string;
    duration?: number; // Total reveal duration (ms)
    speed?: number; // How often (ms) to update unrevealed letters
    delay?: number; // Delay before starting the reveal (ms)
    inView?: boolean;
    rightToLeft?: boolean;
    onComplete?: () => void; // Add completion callback
}

const defaultChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const scrambleText = (
    element: HTMLElement,
    config: ScrambleTextConfig
): () => void => {
    // Extract configuration with defaults
    const finalText = config.text;
    const totalDuration = config.duration ?? 2000;
    const updateSpeed = config.speed ?? 50;
    const delay = config.delay ?? 0;
    const chars = config.chars ?? defaultChars;
    const inView = config.inView ?? true;
    const rightToLeft = config.rightToLeft ?? false;

    let frame: number;
    let startTime: number | null = null;
    let delayStartTime: number | null = null;
    let lastRandomUpdateTime: number = 0;
    let revealed = 0;

    // Initialize a cache of random letters for each non‑whitespace character.
    let cachedRandomChars = finalText.split("").map((c) =>
        c === " " || c === "\n" ? c : getRandomChar()
    );

    function getRandomChar() {
        return chars[Math.floor(Math.random() * chars.length)];
    }

    function matchCase(source: string, target: string) {
        return source === source.toUpperCase() ? target.toUpperCase() : target.toLowerCase();
    }

    // updateText will build the output string by checking each character’s "reveal" threshold.
    const updateText = (elapsed: number) => {
        let result = "";
        const totalChars = finalText.length;

        for (let i = 0; i < totalChars; i++) {
            // Determine the order for reveal based on animation direction.
            // For left-to-right, indexForReveal is just i.
            // For right-to-left, we reveal starting from the end.
            const indexForReveal = rightToLeft ? totalChars - 1 - i : i;
            // Each character gets its own reveal time proportional to its index.
            const revealTime = (indexForReveal / totalChars) * totalDuration;

            // If elapsed time is past the reveal threshold, show the final character;
            // otherwise show the cached random character (or preserve whitespace)
            if (elapsed >= revealTime) {
                result += finalText[i];
            } else {
                result +=
                    finalText[i] === " " || finalText[i] === "\n"
                        ? finalText[i]
                        : matchCase(finalText[i], cachedRandomChars[i]);
            }
        }
        element.textContent = result;
    };

    // The animate function uses requestAnimationFrame to update the text.
    const animate = (timestamp: number) => {
        if (!inView) {
            element.textContent = finalText;
            return;
        }

        // Set up delay phase
        if (!delayStartTime) {
            delayStartTime = timestamp;
            // (Re)initialize the random cache so the scramble always starts fresh.
            cachedRandomChars = finalText.split("").map((c) =>
                c === " " || c === "\n" ? c : getRandomChar()
            );
            element.textContent = cachedRandomChars.join("");
            lastRandomUpdateTime = timestamp;
        }
        if (timestamp - delayStartTime < delay) {
            element.textContent = cachedRandomChars.join("");
            frame = requestAnimationFrame(animate);
            return;
        }
        if (startTime === null) {
            startTime = timestamp;
        }
        const elapsed = timestamp - startTime;

        // Only update the cache every updateSpeed ms, so that letters don’t change every frame.
        if (timestamp - lastRandomUpdateTime >= updateSpeed) {
            for (let i = 0; i < finalText.length; i++) {
                const indexForReveal = rightToLeft ? finalText.length - 1 - i : i;
                const revealTime = (indexForReveal / finalText.length) * totalDuration;
                if (elapsed < revealTime && finalText[i] !== " " && finalText[i] !== "\n") {
                    cachedRandomChars[i] = getRandomChar();
                }
            }
            lastRandomUpdateTime = timestamp;
        }

        updateText(elapsed);

        if (elapsed < totalDuration) {
            frame = requestAnimationFrame(animate);
        } else {
            element.textContent = finalText;
            config.onComplete?.();
        }
    };

    // Add pre-initialization scramble
    element.textContent = finalText
        .split('')
        .map(() => chars[Math.floor(Math.random() * chars.length)])
        .join('');

    if (inView) {
        frame = requestAnimationFrame(animate);
    }

    // Return a cleanup function
    return () => {
        if (frame) {
            cancelAnimationFrame(frame);
        }
    };
};

// React hook for using scrambleText
export const useScrambleText = <T extends HTMLElement>(
    text: string,
    config?: Omit<ScrambleTextConfig, "text">
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
                ...config,
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
