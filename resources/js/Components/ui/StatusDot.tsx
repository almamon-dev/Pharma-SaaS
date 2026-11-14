import React from 'react';
import { cn } from '@/lib/cn';

export type StatusDotVariant =
    | 'emerald'
    | 'amber'
    | 'rose'
    | 'brand'
    | 'sky'
    | 'slate';

const dotColors: Record<StatusDotVariant, string> = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    brand: 'bg-[#FF4A1F]',
    sky: 'bg-sky-500',
    slate: 'bg-slate-400',
};

const textColors: Record<StatusDotVariant, string> = {
    emerald: 'text-emerald-700 dark:text-emerald-400',
    amber: 'text-amber-700 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
    brand: 'text-[#D13915] dark:text-[#FF4A1F]',
    sky: 'text-sky-700 dark:text-sky-400',
    slate: 'text-slate-500 dark:text-slate-400',
};

interface StatusDotProps {
    variant?: StatusDotVariant;
    children: React.ReactNode;
    className?: string;
}

export const StatusDot: React.FC<StatusDotProps> = ({
    variant = 'slate',
    children,
    className,
}) => {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap',
                textColors[variant],
                className
            )}
        >
            <span
                className={cn(
                    'h-1.5 w-1.5 rounded-full shrink-0',
                    dotColors[variant]
                )}
            />
            {children}
        </span>
    );
};

