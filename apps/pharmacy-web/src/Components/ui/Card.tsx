import React from 'react';
import { cn } from '@/lib/cn';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
    className,
    children,
    ...props
}) => (
    <div
        className={cn(
            'rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#1e2329]',
            className
        )}
        {...props}
    >
        {children}
    </div>
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
    className,
    children,
    ...props
}) => (
    <div
        className={cn(
            'flex items-center justify-between gap-3 border-b border-[#E2E6E1] dark:border-slate-800 px-4 sm:px-5 py-3.5',
            className
        )}
        {...props}
    >
        {children}
    </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
    className,
    children,
    ...props
}) => (
    <h3
        className={cn(
            'text-sm font-bold text-[#0E5F3F] dark:text-emerald-400 tracking-tight',
            className
        )}
        {...props}
    >
        {children}
    </h3>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
    className,
    children,
    ...props
}) => (
    <div className={cn('p-4 sm:p-5', className)} {...props}>
        {children}
    </div>
);
