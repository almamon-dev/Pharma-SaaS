import React from 'react';
import { cn } from '@/lib/cn';

export interface MetricCardProps {
    title: string;
    description?: string;
    value: string | number;
    icon?: React.ElementType;
    colorClass?: string;
    isLoading?: boolean;
    isLastOnMobile?: boolean;
    onClick?: () => void;
    badge?: React.ReactNode;
    className?: string;
    valueClassName?: string;
    trend?: string | React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
    title,
    description,
    value,
    icon: Icon,
    colorClass = 'bg-orange-50 dark:bg-[#ff4a1f]/10 text-[#FF4A1F]',
    isLoading = false,
    isLastOnMobile = false,
    onClick,
    badge,
    className = '',
    valueClassName = '',
    trend,
}) => {
    const inner = (
        <div
            className={cn(
                'bg-white dark:bg-[#1e2329] p-2.5 sm:p-3 md:p-3.5 rounded-[4px] border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all flex flex-col justify-between w-full shadow-2xs',
                onClick && 'cursor-pointer',
                isLastOnMobile && 'col-span-2 sm:col-span-1',
                className
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                            {title}
                        </p>
                        {badge}
                    </div>
                </div>
                {Icon && (
                    <div
                        className={cn(
                            'w-7 h-7 sm:w-8 sm:h-8 rounded-[4px] flex items-center justify-center shrink-0',
                            colorClass
                        )}
                    >
                        <Icon className="w-4 h-4" />
                    </div>
                )}
            </div>

            <div className="mt-2">
                {isLoading ? (
                    <div className="h-6 w-24 rounded-[3px] bg-slate-200 dark:bg-slate-700 animate-pulse" />
                ) : (
                    <div className="flex items-baseline justify-between gap-2">
                        <p
                            className={cn(
                                'text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums',
                                valueClassName
                            )}
                        >
                            {value}
                        </p>
                        {trend && (
                            <div className="text-[11px] font-semibold shrink-0">
                                {trend}
                            </div>
                        )}
                    </div>
                )}
                {description && (
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {description}
                    </p>
                )}
            </div>
        </div>
    );

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4A1F] rounded-[4px]"
            >
                {inner}
            </button>
        );
    }

    return inner;
};

export default MetricCard;

