import React from 'react';
import { cn } from '@/lib/cn';

interface BrandLogoProps {
    className?: string;
    subtitle?: string;
    inverted?: boolean;
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
}

const iconSizes = {
    sm: 'h-7 w-7 rounded-[2px]',
    md: 'h-8 w-8 rounded-[2px]',
    lg: 'h-11 w-11 rounded-[2px]',
};

const svgSizes = {
    sm: 'h-4 w-4',
    md: 'h-4.5 w-4.5',
    lg: 'h-6 w-6',
};

const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
    className,
    subtitle,
    inverted = false,
    size = 'md',
    showText = true,
}) => {
    return (
        <div className={cn('flex items-center gap-2.5', className)}>
            <div
                className={cn(
                    'flex shrink-0 items-center justify-center bg-[#0E5F3F] text-white shadow-xs',
                    iconSizes[size]
                )}
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className={svgSizes[size]}
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M12 5v14M5 12h14" />
                </svg>
            </div>
            {showText && (
                <div className="leading-tight">
                    <div
                        className={cn(
                            'font-extrabold tracking-tight',
                            textSizes[size],
                            inverted
                                ? 'text-white'
                                : 'text-slate-900 dark:text-slate-100'
                        )}
                    >
                        Pharma
                        <span className="text-[#0E5F3F]">Core</span>
                    </div>
                    {subtitle && (
                        <div
                            className={cn(
                                'text-[11px] font-medium',
                                inverted
                                    ? 'text-slate-300'
                                    : 'text-slate-500 dark:text-slate-400'
                            )}
                        >
                            {subtitle}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
