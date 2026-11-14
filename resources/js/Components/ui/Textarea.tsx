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
            <div className="flex flex-col gap-1 w-full font-sans antialiased">
                {label && (
                    <label
                        htmlFor={textareaId}
                        className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 font-sans"
                    >
                        {label}
                        {required && (
                            <span className="text-red-500 font-bold ml-0.5">
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
                        'block w-full rounded-sm border bg-white dark:bg-[#12161c] px-3 py-2 text-[13px] font-normal text-[#202223] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-0 transition-colors',
                        error
                            ? 'border-[#d82c0d] focus:border-[#d82c0d]'
                            : 'border-slate-300 dark:border-slate-700/80 focus:border-slate-400 dark:focus:border-slate-500',
                        className
                    )}
                    {...props}
                />
                {error && (
                    <span className="text-[12px] text-[#d82c0d] mt-0.5 font-sans">
                        {error}
                    </span>
                )}
            </div>
        );
    }
);
Textarea.displayName = 'Textarea';
