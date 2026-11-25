import * as React from 'react';
import { cn } from '@/lib/cn';

export type FormLayoutMode = 'vertical' | 'horizontal';

interface FormLayoutContextValue {
    layout: FormLayoutMode;
    labelWidth: string;
}

const FormLayoutContext = React.createContext<FormLayoutContextValue>({
    layout: 'vertical',
    labelWidth: 'sm:w-[155px]',
});

/**
 * Provides default form field layout (`vertical` or `horizontal`) and label width
 * to nested Input, Select, Textarea, DatePicker, and HorizontalFormRow components.
 */
export function FormLayoutProvider({
    layout = 'horizontal',
    labelWidth = 'sm:w-[155px]',
    children,
}: {
    layout?: FormLayoutMode;
    labelWidth?: string;
    children: React.ReactNode;
}) {
    const value = React.useMemo(() => ({ layout, labelWidth }), [layout, labelWidth]);
    return <FormLayoutContext.Provider value={value}>{children}</FormLayoutContext.Provider>;
}

export function useFormLayout() {
    return React.useContext(FormLayoutContext);
}

/**
 * Renders a field label with a red required asterisk when `required` is true
 * or when `labelStr` ends with `*`.
 */
export function renderFieldLabel(labelStr: string, required?: boolean) {
    if (labelStr.endsWith('*')) {
        const baseText = labelStr.slice(0, -1).trim();
        return (
            <>
                {baseText}
                <span className="text-red-500 font-bold ml-0.5">*</span>
            </>
        );
    }
    return (
        <>
            {labelStr}
            {required && <span className="text-red-500 font-bold ml-0.5">*</span>}
        </>
    );
}

export interface FieldWrapperProps {
    label?: string;
    htmlFor?: string;
    required?: boolean;
    error?: string | boolean;
    layout?: FormLayoutMode;
    labelWidth?: string;
    className?: string;
    children: React.ReactNode;
}

/**
 * Wraps a form control in either vertical stacked layout or horizontal
 * (`Label : Field`) inline form input group layout.
 */
export function FieldWrapper({
    label,
    htmlFor,
    required,
    error,
    layout: layoutOverride,
    labelWidth: labelWidthOverride,
    className,
    children,
}: FieldWrapperProps) {
    const ctx = useFormLayout();
    const resolvedLayout = layoutOverride ?? ctx.layout;
    const resolvedLabelWidth = labelWidthOverride ?? ctx.labelWidth;

    if (resolvedLayout === 'horizontal' && label) {
        return (
            <div
                className={cn(
                    'flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2.5 w-full font-sans antialiased',
                    className
                )}
            >
                <div
                    className={cn(
                        'flex items-center justify-between shrink-0 sm:min-h-[30px]',
                        resolvedLabelWidth
                    )}
                >
                    <label
                        htmlFor={htmlFor}
                        className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-300 font-sans leading-snug"
                    >
                        {renderFieldLabel(label, required)}
                    </label>
                    <span
                        aria-hidden="true"
                        className="hidden sm:inline text-slate-500 dark:text-slate-400 font-semibold select-none pl-1.5"
                    >
                        :
                    </span>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    {children}
                    {typeof error === 'string' && error && (
                        <span className="text-[12px] text-[#d82c0d] font-sans">{error}</span>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={cn('flex flex-col gap-1 w-full font-sans antialiased', className)}>
            {label && (
                <label
                    htmlFor={htmlFor}
                    className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 font-sans"
                >
                    {renderFieldLabel(label, required)}
                </label>
            )}
            {children}
            {typeof error === 'string' && error && (
                <span className="text-[12px] text-[#d82c0d] mt-0.5 font-sans">{error}</span>
            )}
        </div>
    );
}

export const HorizontalFormRow = FieldWrapper;

