import React from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    error?: string;
    label?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, error, label, id, required, rows = 3, ...props }, ref) => {
        const textareaId =
            id ||
            (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

        return (
            <div className="flex flex-col gap-1 w-full font-sans">
                {label && (
                    <label
                        htmlFor={textareaId}
                        className="text-[13px] font-semibold text-[#333333] dark:text-slate-200 font-sans"
                    >
                        {label}
                        {required && (
                            <span className="text-[#C9302C] font-bold ml-0.5">
                                *
                            </span>
                        )}
                    </label>
                )}
                <textarea
                    id={textareaId}
                    ref={ref}
                    required={required}
                    rows={rows}
                    className={cn(
                        'block w-full rounded-[2px] border bg-white dark:bg-[#12161c] px-3 py-2 text-[13px] font-normal text-[#333333] dark:text-slate-100 placeholder:text-[#777777] dark:placeholder:text-slate-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[#EDEDED] disabled:text-[#4A4A4A] disabled:border-[#CCCCCC] dark:disabled:bg-slate-800/80 dark:disabled:text-slate-300 read-only:bg-[#EDEDED] read-only:text-[#4A4A4A] transition-colors',
                        error
                            ? 'border-[#C9302C]'
                            : 'border-[#CCCCCC] dark:border-slate-700',
                        className
                    )}
                    {...props}
                />
                {error && (
                    <span className="text-[12px] text-[#C9302C] mt-0.5 font-sans">
                        {error}
                    </span>
                )}
            </div>
        );
    }
);
Textarea.displayName = 'Textarea';
