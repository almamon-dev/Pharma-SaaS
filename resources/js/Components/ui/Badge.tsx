import React from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant =
    | 'emerald'
    | 'amber'
    | 'rose'
    | 'slate'
    | 'teal'
    | 'sky'
    | 'orange'
    | 'brand'
    | 'success'
    | 'pending'
    | 'failed'
    | 'neutral';

export interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
    emerald:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    success:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    teal: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    pending:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
    failed: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
    sky: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20',
    orange: 'bg-[#FFF0ED] text-[#D13915] border-[#FF4A1F]/25 dark:bg-[#ff4a1f]/15 dark:text-[#FF4A1F] dark:border-[#ff4a1f]/30',
    brand: 'bg-[#FFF0ED] text-[#D13915] border-[#FF4A1F]/25 dark:bg-[#ff4a1f]/15 dark:text-[#FF4A1F] dark:border-[#ff4a1f]/30',
    slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    neutral:
        'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'slate',
    className,
}) => {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-[3px] border px-2 py-0.5 text-[11px] font-semibold tracking-tight',
                variantClasses[variant],
                className
            )}
        >
            {children}
        </span>
    );
};
