import React from 'react';
import { ChevronLeft, ChevronRight, Save, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export const brtaInputClass =
    'w-full h-[36px] px-3 text-[13px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] text-[#222222] dark:text-slate-100 placeholder:text-slate-400 outline-none focus:outline-none focus:ring-0 disabled:bg-[#EDEDED] dark:disabled:bg-slate-800';

export const brtaTextareaClass =
    'w-full px-3 py-2 text-[13px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] text-[#222222] dark:text-slate-100 placeholder:text-slate-400 outline-none focus:outline-none focus:ring-0';

interface BrtaFieldProps {
    label: React.ReactNode;
    required?: boolean;
    error?: string;
    hint?: string;
    labelWidthClass?: string;
    alignTop?: boolean;
    className?: string;
    children: React.ReactNode;
}

/**
 * BRTA Horizontal Form Row: right-aligned bold label + red asterisk on left, crisp input on right.
 */
export const BrtaField: React.FC<BrtaFieldProps> = ({
    label,
    required = false,
    error,
    hint,
    labelWidthClass = 'sm:w-[150px]',
    alignTop = false,
    className,
    children,
}) => (
    <div
        className={cn(
            'flex flex-col sm:flex-row gap-1.5 sm:gap-3',
            alignTop ? 'sm:items-start' : 'sm:items-center',
            className
        )}
    >
        <label
            className={cn(
                'sm:text-right text-[13px] font-bold text-[#333333] dark:text-slate-200 shrink-0 leading-snug',
                alignTop && 'sm:pt-2',
                labelWidthClass
            )}
        >
            {label}
            {required && <span className="text-[#D9534F] ml-0.5">*</span>}
        </label>
        <div className="flex-1 min-w-0">
            {children}
            {hint && !error && (
                <p className="mt-1 text-[11px] text-[#666666] dark:text-slate-400">{hint}</p>
            )}
            {error && (
                <p className="mt-1 text-[11.5px] font-medium text-[#C9302C] dark:text-rose-400">
                    {error}
                </p>
            )}
        </div>
    </div>
);

export const BrtaFormGrid: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className,
}) => (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4', className)}>
        {children}
    </div>
);

/**
 * BRTA Bordered Connected Option Strip (for radio / checkbox groups).
 */
export const BrtaOptionStrip: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className,
}) => (
    <div
        className={cn(
            'flex flex-wrap items-stretch border border-[#CCCCCC] dark:border-slate-700 rounded-[2px] divide-y sm:divide-y-0 sm:divide-x divide-[#CCCCCC] dark:divide-slate-700 bg-white dark:bg-[#181d25]',
            className
        )}
    >
        {children}
    </div>
);

export const BrtaOptionItem: React.FC<{
    children: React.ReactNode;
    className?: string;
}> = ({ children, className }) => (
    <label
        className={cn(
            'inline-flex items-center gap-2 px-3.5 py-2 text-[12.5px] font-semibold text-[#333333] dark:text-slate-200 cursor-pointer hover:bg-[#F5F7F4] dark:hover:bg-slate-800 select-none',
            className
        )}
    >
        {children}
    </label>
);

interface BrtaFormFooterProps {
    leftText?: React.ReactNode;
    onCancel?: () => void;
    cancelLabel?: string;
    onPrev?: () => void;
    prevLabel?: string;
    prevDisabled?: boolean;
    onNext?: () => void;
    nextLabel?: string;
    submitLabel?: string;
    submitDisabled?: boolean;
    submitting?: boolean;
    showSubmit?: boolean;
    extraButtons?: React.ReactNode;
    className?: string;
}

/**
 * BRTA Standard Action Footer:
 *  - Cancel / < Previous : Blue (#337AB7)
 *  - Next >              : Green (#5CB85C)
 *  - Submit / Update     : Cyan (#5BC0DE) with Save icon
 */
export const BrtaFormFooter: React.FC<BrtaFormFooterProps> = ({
    leftText,
    onCancel,
    cancelLabel = 'Cancel',
    onPrev,
    prevLabel = 'Previous',
    prevDisabled = false,
    onNext,
    nextLabel = 'Next',
    submitLabel = 'Submit',
    submitDisabled = false,
    submitting = false,
    showSubmit = true,
    extraButtons,
    className,
}) => (
    <div
        className={cn(
            'px-6 py-3.5 border-t border-[#E5E7EB] dark:border-slate-800 bg-[#FAFAFA] dark:bg-[#12161c] flex flex-wrap items-center justify-between gap-3',
            className
        )}
    >
        <div className="text-[12px] font-medium text-[#666666] dark:text-slate-400">
            {leftText}
        </div>
        <div className="flex items-center gap-2 ml-auto">
            {extraButtons}

            {onPrev && (
                <button
                    type="button"
                    disabled={prevDisabled || submitting}
                    onClick={onPrev}
                    className="inline-flex items-center gap-1 h-[34px] px-3.5 text-[13px] font-semibold rounded-[2px] bg-[#337AB7] hover:bg-[#286090] border border-[#2E6DA4] text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                    <span>{prevLabel}</span>
                </button>
            )}

            {!onPrev && onCancel && (
                <button
                    type="button"
                    disabled={submitting}
                    onClick={onCancel}
                    className="inline-flex items-center gap-1 h-[34px] px-3.5 text-[13px] font-semibold rounded-[2px] bg-[#337AB7] hover:bg-[#286090] border border-[#2E6DA4] text-white disabled:opacity-50 cursor-pointer transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                    <span>{cancelLabel}</span>
                </button>
            )}

            {onNext && (
                <button
                    type="button"
                    disabled={submitting}
                    onClick={onNext}
                    className="inline-flex items-center gap-1 h-[34px] px-3.5 text-[13px] font-semibold rounded-[2px] bg-[#5CB85C] hover:bg-[#449D44] border border-[#4CAE4C] text-white disabled:opacity-50 cursor-pointer transition-colors"
                >
                    <span>{nextLabel}</span>
                    <ChevronRight className="h-4 w-4" />
                </button>
            )}

            {showSubmit && (
                <button
                    type="submit"
                    disabled={submitDisabled || submitting}
                    className="inline-flex items-center gap-1.5 h-[34px] px-4 text-[13px] font-semibold rounded-[2px] bg-[#5BC0DE] hover:bg-[#31B0D5] border border-[#46B8DA] text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                    <Save className="h-3.5 w-3.5" />
                    <span>{submitting ? 'Saving...' : submitLabel}</span>
                </button>
            )}
        </div>
    </div>
);

interface BrtaFormModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    icon?: React.ReactNode;
    maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
    steps?: Array<{ step: number; label: string }>;
    currentStep?: number;
    onStepClick?: (step: number) => void;
    footerProps?: BrtaFormFooterProps;
    children: React.ReactNode;
}

const WIDTH_MAP: Record<NonNullable<BrtaFormModalProps['maxWidth']>, string> = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
};

export const BrtaFormModal: React.FC<BrtaFormModalProps> = ({
    open,
    onClose,
    onSubmit,
    title,
    subtitle,
    icon,
    maxWidth = '3xl',
    steps,
    currentStep,
    onStepClick,
    footerProps,
    children,
}) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
            <div
                className={cn(
                    'bg-white dark:bg-[#151921] border border-[#CCCCCC] dark:border-slate-800 rounded-[4px] w-full shadow-2xl overflow-hidden my-6',
                    WIDTH_MAP[maxWidth]
                )}
            >
                <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#E5E7EB] dark:border-slate-800 bg-[#F8FAF8] dark:bg-[#12161c]">
                    <div className="flex items-center gap-2 min-w-0">
                        {icon && <span className="text-[#0E5F3F] shrink-0">{icon}</span>}
                        <div className="min-w-0">
                            <h3 className="text-[15px] font-bold text-[#222222] dark:text-slate-100 truncate">
                                {title}
                            </h3>
                            {subtitle && (
                                <p className="text-[11.5px] text-[#666666] dark:text-slate-400 truncate">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {steps && steps.length > 0 && currentStep !== undefined && (
                    <div className="px-6 py-2.5 border-b border-[#E5E7EB] dark:border-slate-800 bg-white dark:bg-[#151921] flex flex-wrap items-center gap-2">
                        {steps.map((item) => {
                            const isActive = currentStep === item.step;
                            const isDone = currentStep > item.step;
                            return (
                                <button
                                    key={item.step}
                                    type="button"
                                    onClick={() => onStepClick?.(item.step)}
                                    className={cn(
                                        'px-3 py-1.5 text-[12px] font-semibold rounded-[2px] border transition-colors cursor-pointer',
                                        isActive
                                            ? 'bg-[#0E5F3F] text-white border-[#0E5F3F]'
                                            : isDone
                                              ? 'bg-[#EAF5F0] text-[#0E5F3F] border-[#0E5F3F]/30 dark:bg-emerald-950/30 dark:text-emerald-300'
                                              : 'bg-[#F5F7F4] dark:bg-[#181d25] text-[#555555] dark:text-slate-400 border-[#D5DBD3] dark:border-slate-700'
                                    )}
                                >
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                <form onSubmit={onSubmit} className="bg-white dark:bg-[#151921]">
                    <div className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">
                        {children}
                    </div>
                    {footerProps && <BrtaFormFooter onCancel={onClose} {...footerProps} />}
                </form>
            </div>
        </div>
    );
};

