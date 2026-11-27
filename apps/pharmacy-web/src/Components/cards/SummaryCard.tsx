import React from 'react';
import { CheckCircle2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SummaryCardProps {
    stepNumber?: number | string;
    badge?: React.ReactNode;
    headerAction?: React.ReactNode;
    title: string | React.ReactNode;
    description?: string | React.ReactNode;
    highlight?: React.ReactNode;
    icon?: LucideIcon | React.ComponentType<{ className?: string }> | React.ReactNode | string;
    iconBgClass?: string;
    isLast?: boolean;
    className?: string;
    onClick?: () => void;
    children?: React.ReactNode;
    footer?: React.ReactNode;
}

function renderCardIcon(
    icon: SummaryCardProps['icon']
): React.ReactNode {
    if (!icon) return null;
    if (typeof icon === 'string') {
        return <span className="text-sm font-semibold">{icon}</span>;
    }
    if (React.isValidElement(icon)) {
        return icon;
    }
    const IconComp = icon as React.ComponentType<{ className?: string }>;
    return <IconComp className="w-4 h-4" />;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
    stepNumber,
    badge,
    headerAction,
    title,
    description,
    highlight,
    icon,
    iconBgClass,
    isLast = false,
    className = '',
    onClick,
    children,
    footer,
}) => {
    const content = (
        <div
            className={cn(
                'bg-white dark:bg-[#12161c] rounded-[2px] p-3 sm:p-3.5 border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between h-full shadow-none',
                onClick && 'cursor-pointer',
                isLast && 'lg:col-span-1',
                className
            )}
        >
            <div className="flex-1">
                {(stepNumber !== undefined || badge || icon || headerAction) && (
                    <div className="flex items-start justify-between gap-2 mb-2">
                        {icon ? (
                            <div
                                className={cn(
                                    'w-7 h-7 sm:w-8 sm:h-8 rounded-[2px] flex items-center justify-center shrink-0',
                                    iconBgClass ??
                                        'bg-[#EAF5F0] dark:bg-[#0E5F3F]/10 text-[#0E5F3F] dark:text-[#0E5F3F]'
                                )}
                            >
                                {renderCardIcon(icon)}
                            </div>
                        ) : (
                            <span />
                        )}

                        <div className="flex items-center gap-1.5 shrink-0">
                            {badge && (
                                typeof badge === 'string' ? (
                                    <span className="text-[11px] font-semibold text-[#0E5F3F]">
                                        {badge}
                                    </span>
                                ) : (
                                    badge
                                )
                            )}
                            {headerAction}
                            {stepNumber !== undefined && (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-[2px] text-[11px] font-bold bg-[#EAF5F0] dark:bg-[#0E5F3F]/15 text-[#0E5F3F]">
                                    {stepNumber}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {typeof title === 'string' ? (
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm mb-0.5 leading-snug">
                        {title}
                    </h3>
                ) : (
                    title
                )}

                {description && (
                    typeof description === 'string' ? (
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                            {description}
                        </p>
                    ) : (
                        description
                    )
                )}

                {children && <div className="mt-2.5">{children}</div>}
            </div>

            {highlight && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    {typeof highlight === 'string' ? (
                        <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{highlight}</span>
                        </>
                    ) : (
                        highlight
                    )}
                </div>
            )}

            {footer && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {footer}
                </div>
            )}
        </div>
    );

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="text-left w-full h-full focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0E5F3F] rounded-[2px] shadow-none"
            >
                {content}
            </button>
        );
    }

    return content;
};

export default SummaryCard;

