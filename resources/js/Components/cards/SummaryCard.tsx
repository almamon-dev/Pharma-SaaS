import React from 'react';
import { CheckCircle2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SummaryCardProps {
    stepNumber?: number | string;
    badge?: string;
    title: string;
    description: string;
    highlight?: string;
    icon?: LucideIcon | React.ComponentType<{ className?: string }> | React.ReactNode | string;
    iconBgClass?: string;
    isLast?: boolean;
    className?: string;
    onClick?: () => void;
    children?: React.ReactNode;
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
    title,
    description,
    highlight,
    icon,
    iconBgClass,
    isLast = false,
    className = '',
    onClick,
    children,
}) => {
    const content = (
        <div
            className={cn(
                'bg-white dark:bg-[#1e2329] rounded-[4px] p-3.5 sm:p-4 border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col justify-between h-full shadow-2xs',
                onClick && 'cursor-pointer',
                isLast && 'lg:col-span-1',
                className
            )}
        >
            <div>
                {(stepNumber !== undefined || badge || icon) && (
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                        {icon ? (
                            <div
                                className={cn(
                                    'w-7 h-7 sm:w-8 sm:h-8 rounded-[4px] flex items-center justify-center shrink-0',
                                    iconBgClass ??
                                        'bg-orange-50 dark:bg-[#ff4a1f]/10 text-[#ea580c] dark:text-[#ff4a1f]'
                                )}
                            >
                                {renderCardIcon(icon)}
                            </div>
                        ) : (
                            <span />
                        )}

                        <div className="flex items-center gap-1.5">
                            {badge && (
                                <span className="text-[11px] font-semibold text-[#FF4A1F]">
                                    {badge}
                                </span>
                            )}
                            {stepNumber !== undefined && (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-[3px] text-[11px] font-bold bg-[#FFF0ED] dark:bg-[#ff4a1f]/15 text-[#FF4A1F]">
                                    {stepNumber}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm mb-1 leading-snug">
                    {title}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                    {description}
                </p>

                {children && <div className="mt-2.5">{children}</div>}
            </div>

            {highlight && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{highlight}</span>
                </div>
            )}
        </div>
    );

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="text-left w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4A1F] rounded-[4px]"
            >
                {content}
            </button>
        );
    }

    return content;
};

export default SummaryCard;

