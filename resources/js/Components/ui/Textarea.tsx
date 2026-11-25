import React from 'react';
import { FieldWrapper, FormLayoutMode } from '@/Components/ui/FormLayout';
import { cn } from '@/lib/cn';

export interface TextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    error?: string;
    label?: string;
    layout?: FormLayoutMode;
    labelWidth?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    (
        { className, error, label, id, required, rows = 3, layout, labelWidth, ...props },
        ref
    ) => {
        const textareaId =
            id ||
            (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

        return (
            <FieldWrapper
                label={label}
                htmlFor={textareaId}
                required={required}
                error={error}
                layout={layout}
                labelWidth={labelWidth}
            >
                <textarea
                    id={textareaId}
                    ref={ref}
                    required={required}
                    rows={rows}
                    className={cn(
                        'block w-full rounded-[1px] border bg-white dark:bg-[#12161c] px-3 py-2 text-[13px] font-normal text-[#202223] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-0 read-only:bg-slate-100 dark:read-only:bg-slate-800/70 read-only:text-slate-600 dark:read-only:text-slate-300 read-only:border-slate-200 dark:read-only:border-slate-700/70 read-only:cursor-default transition-colors',
                        error
                            ? 'border-[#d82c0d] focus:border-[#d82c0d]'
                            : 'border-slate-300 dark:border-slate-700/80 focus:border-slate-400 dark:focus:border-slate-500',
                        className
                    )}
                    {...props}
                />
            </FieldWrapper>
        );
    }
);
Textarea.displayName = 'Textarea';
