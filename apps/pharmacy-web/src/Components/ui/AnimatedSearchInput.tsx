import * as React from 'react';
import { cn } from '@/lib/cn';

const DEFAULT_PLACEHOLDERS = [
    'Scan barcode or SKU (F2)...',
    'Search medicine name (e.g. Napa, Seclo, Monas)...',
    'Search by generic name, strength, or brand...',
    'Press Enter to add instantly...',
];

/**
 * Derive cycling typewriter phrases from a standard comma/or-delimited placeholder string.
 */
export function buildSearchPhrases(placeholder?: string): string[] {
    const clean = (placeholder || '').trim();
    if (!clean) {
        return DEFAULT_PLACEHOLDERS;
    }

    const stripped = clean.replace(/\.{2,}$/, '').trim();
    const isBn = /[\u0980-\u09FF]/.test(stripped);

    const parts = stripped
        .replace(/^(search across all [\d,]+\+?\s+\w+\s*(?:by|for)?\s*|search\s+(?:by|for)?\s*)/i, '')
        .replace(/[()]/g, ',')
        .split(/,|\bor\b|\bবা\b/i)
        .map((p) => p.replace(/(দিয়ে|দিয়ে)?\s*সার্চ(\s*করুন)?/g, '').trim())
        .filter((p) => p.length >= 2 && !/^e\.?g\.?$/i.test(p));

    if (parts.length >= 2) {
        const phrases = parts.slice(0, 4).map((part) =>
            isBn ? `${part} দিয়ে সার্চ করুন...` : `Search by ${part}...`
        );
        return phrases;
    }

    return [
        clean,
        isBn ? 'খুঁজতে টাইপ করুন...' : 'Type keyword to filter results...',
    ];
}

export interface AnimatedSearchInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'placeholder'> {
    placeholders?: string[];
    typingSpeedMs?: number;
    deletingSpeedMs?: number;
    pauseMs?: number;
    icon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    wrapperClassName?: string;
}

export const AnimatedSearchInput = React.forwardRef<
    HTMLInputElement,
    AnimatedSearchInputProps
>(
    (
        {
            placeholders = DEFAULT_PLACEHOLDERS,
            typingSpeedMs = 70,
            deletingSpeedMs = 35,
            pauseMs = 2200,
            icon,
            rightIcon,
            className,
            wrapperClassName,
            value,
            ...props
        },
        ref
    ) => {
        const [phraseIdx, setPhraseIdx] = React.useState(0);
        const [typedText, setTypedText] = React.useState('');
        const [isDeleting, setIsDeleting] = React.useState(false);

        const hasValue = value !== undefined && String(value).length > 0;
        const safePlaceholders = placeholders.length > 0 ? placeholders : DEFAULT_PLACEHOLDERS;
        const currentPhrase = safePlaceholders[phraseIdx % safePlaceholders.length] ?? '';

        React.useEffect(() => {
            if (hasValue || !currentPhrase) return;

            let timeoutId: number;

            if (!isDeleting) {
                if (typedText.length < currentPhrase.length) {
                    timeoutId = window.setTimeout(() => {
                        setTypedText(currentPhrase.slice(0, typedText.length + 1));
                    }, typingSpeedMs);
                } else {
                    timeoutId = window.setTimeout(() => {
                        setIsDeleting(true);
                    }, pauseMs);
                }
            } else {
                if (typedText.length > 0) {
                    timeoutId = window.setTimeout(() => {
                        setTypedText(currentPhrase.slice(0, typedText.length - 1));
                    }, deletingSpeedMs);
                } else {
                    timeoutId = window.setTimeout(() => {
                        setIsDeleting(false);
                        setPhraseIdx((prev) => (prev + 1) % placeholders.length);
                    }, 450);
                }
            }

            return () => window.clearTimeout(timeoutId);
        }, [
            typedText,
            isDeleting,
            phraseIdx,
            currentPhrase,
            placeholders.length,
            typingSpeedMs,
            deletingSpeedMs,
            pauseMs,
            hasValue,
        ]);

        return (
            <div
                className={cn(
                    'group relative flex items-center w-full rounded-full animated-search-pill',
                    wrapperClassName
                )}
            >
                {icon && (
                    <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center z-10 text-[#0E5F3F] transition-transform duration-200 group-focus-within:scale-105">
                        {icon}
                    </div>
                )}

                {/* Typewriter animated placeholder overlay */}
                {!hasValue && (
                    <div
                        aria-hidden="true"
                        className={cn(
                            'pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center overflow-hidden select-none text-[12.5px] text-[#777777] dark:text-slate-400',
                            icon ? 'pl-10' : 'pl-4',
                            rightIcon ? 'pr-12' : 'pr-4'
                        )}
                    >
                        <span className="truncate">{typedText}</span>
                        <span className="ml-[1px] inline-block h-[14px] w-[1.5px] shrink-0 bg-[#0E5F3F]/70 dark:bg-emerald-400/80 animate-search-caret-blink" />
                    </div>
                )}

                <input
                    ref={ref}
                    value={value}
                    aria-label={props['aria-label'] || currentPhrase}
                    className={cn(
                        'block h-[34px] w-full rounded-full border-0 bg-transparent py-1 text-[12.5px] font-normal text-[#333333] dark:text-slate-100 focus:outline-none focus:ring-0 font-sans',
                        icon ? 'pl-10' : 'pl-4',
                        rightIcon ? 'pr-12' : 'pr-4',
                        className
                    )}
                    {...props}
                />

                {rightIcon && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center z-10">
                        {rightIcon}
                    </div>
                )}
            </div>
        );
    }
);

AnimatedSearchInput.displayName = 'AnimatedSearchInput';

export default AnimatedSearchInput;
