import * as React from 'react';
import { cn } from '@/lib/cn';

const variantStyles = {
    default: 'bg-[#FF4A1F] text-white hover:bg-[#E03E15] active:scale-[0.99] cursor-pointer',
    primary: 'bg-[#FF4A1F] text-white hover:bg-[#E03E15] active:scale-[0.99] cursor-pointer',
    destructive: 'bg-red-500 text-white hover:bg-red-600 active:scale-[0.99] cursor-pointer',
    danger: 'bg-red-500 text-white hover:bg-red-600 active:scale-[0.99] cursor-pointer',
    outline:
        'border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 active:scale-[0.99] cursor-pointer',
    'dark-outline':
        'border border-white/30 bg-white/5 text-white hover:bg-white/10 hover:border-white/60 active:scale-95 cursor-pointer',
    secondary:
        'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.99] cursor-pointer',
    ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 active:scale-[0.99] cursor-pointer',
    link: 'text-[#FF4A1F] underline-offset-4 hover:underline cursor-pointer',
} as const;

const sizeStyles = {
    default: 'h-[42px] px-4 py-2 text-[14px] rounded-[4px]',
    sm: 'h-8 rounded-[4px] px-3 text-xs',
    md: 'h-9 px-4 py-2 rounded-[4px] text-[13px]',
    lg: 'h-11 rounded-[4px] px-8 text-base',
    icon: 'h-9 w-9 rounded-[4px]',
} as const;

export type ButtonVariant = keyof typeof variantStyles;
export type ButtonSize = keyof typeof sizeStyles;

export const buttonVariants = ({
    variant = 'default',
    size = 'default',
    className,
}: {
    variant?: ButtonVariant;
    size?: ButtonSize;
    className?: string;
} = {}) =>
    cn(
        'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-80 font-sans antialiased text-center',
        variantStyles[variant],
        sizeStyles[size],
        className
    );

export const BinanceEqualizer = ({ className }: { className?: string } = {}) => (
    <div className="flex items-center justify-center gap-[4px] h-5 py-1">
        <span
            className={cn('w-[3px] bg-current rounded-full animate-equalizer', className)}
            style={{ animationDelay: '0ms' }}
        />
        <span
            className={cn('w-[3px] bg-current rounded-full animate-equalizer', className)}
            style={{ animationDelay: '150ms' }}
        />
        <span
            className={cn('w-[3px] bg-current rounded-full animate-equalizer', className)}
            style={{ animationDelay: '300ms' }}
        />
        <span
            className={cn('w-[3px] bg-current rounded-full animate-equalizer', className)}
            style={{ animationDelay: '450ms' }}
        />
    </div>
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    fullWidth?: boolean;
    icon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = 'default',
            size = 'default',
            isLoading = false,
            fullWidth = false,
            icon,
            children,
            disabled,
            ...props
        },
        ref
    ) => {
        return (
            <button
                className={cn(buttonVariants({ variant, size, className }), fullWidth && 'w-full')}
                ref={ref}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && (
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <BinanceEqualizer />
                    </span>
                )}
                <span
                    className={cn(
                        'inline-flex items-center justify-center gap-1.5 text-center',
                        isLoading && 'invisible'
                    )}
                >
                    {icon && <span className="inline-flex shrink-0">{icon}</span>}
                    {children}
                </span>
            </button>
        );
    }
);
Button.displayName = 'Button';

export { Button };
export default Button;

