import { useEffect, useState } from 'react';

export const POS_SEARCH_PLACEHOLDERS = [
    'Scan barcode or SKU (F2)...',
    'Search medicine by name or generic...',
    'Type e.g. Napa 500mg, Sergel 20mg...',
    'Press Enter to add first match...',
] as const;

/**
 * Animates placeholder text with a continuous typewriter effect and pauses
 * cleanly while the input already contains a user query.
 */
export function useTypingPlaceholder(
    phrases: readonly string[],
    paused = false
): string {
    const [phraseIdx, setPhraseIdx] = useState(0);
    const [charCount, setCharCount] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (paused || phrases.length === 0) {
            return;
        }

        const current = phrases[phraseIdx % phrases.length] ?? '';
        let delay = isDeleting ? 26 : 52;

        if (!isDeleting && charCount >= current.length) {
            delay = 1500;
        } else if (isDeleting && charCount <= 0) {
            delay = 320;
        }

        const timer = window.setTimeout(() => {
            if (!isDeleting) {
                if (charCount < current.length) {
                    setCharCount((c) => c + 1);
                } else {
                    setIsDeleting(true);
                }
            } else {
                if (charCount > 0) {
                    setCharCount((c) => c - 1);
                } else {
                    setIsDeleting(false);
                    setPhraseIdx((idx) => (idx + 1) % phrases.length);
                }
            }
        }, delay);

        return () => window.clearTimeout(timer);
    }, [phrases, phraseIdx, charCount, isDeleting, paused]);

    const activePhrase = phrases[phraseIdx % phrases.length] ?? '';
    return `${activePhrase.slice(0, charCount)}|`;
}

