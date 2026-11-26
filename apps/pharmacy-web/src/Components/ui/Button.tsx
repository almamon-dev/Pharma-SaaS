import * as React from 'react';
import { cn } from '@/lib/cn';

const variantStyles = {
    default: 'bg-[#5CB85C] !text-white hover:!text-white border border-[#4CAE4C] hover:bg-[#449D44] hover:border-[#398439] active:scale-[0.99] cursor-pointer',
    primary: 'bg-[#5CB85C] !text-white hover:!text-white border border-[#4CAE4C] hover:bg-[#449D44] hover:border-[#398439] active:scale-[0.99] cursor-pointer',
    destructive: 'bg-[#D9534F] !text-white hover:!text-white border border-[#D43F3A] hover:bg-[#C9302C] hover:border-[#AC2925] active:scale-[0.99] cursor-pointer',
    danger: 'bg-[#D9534F] !text-white hover:!text-white border border-[#D43F3A] hover:bg-[#C9302C] hover:border-[#AC2925] active:scale-[0.99] cursor-pointer',
    outline:
        'border border-[#2E6DA4] bg-[#337AB7] !text-white hover:!text-white hover:bg-[#286090] hover:border-[#204D74] active:scale-[0.99] cursor-pointer',
    'dark-outline':
        'border border-white/30 bg-white/5 !text-white hover:!text-white hover:bg-white/10 hover:border-white/60 active:scale-95 cursor-pointer',
    secondary:
        'border border-[#2E6DA4] bg-[#337AB7] !text-white hover:!text-white hover:bg-[#286090] hover:border-[#204D74] active:scale-[0.99] cursor-pointer',
    ghost: 'text-[#333333] dark:text-slate-200 hover:bg-[#EAF5F0] dark:hover:bg-slate-800 hover:text-[#333333] dark:hover:text-slate-100 active:scale-[0.99] cursor-pointer',
    link: 'text-[#337AB7] hover:text-[#23527C] underline-offset-4 hover:underline cursor-pointer',
} as const;

const sizeStyles = {
    default: 'h-[40px] px-4 py-2 text-[14px] rounded-[2px]',
    sm: 'h-8 rounded-[2px] px-3 text-xs',
    md: 'h-9 px-4 py-2 rounded-[2px] text-[13px]',
    lg: 'h-11 rounded-[2px] px-8 text-base',
    icon: 'h-9 w-9 rounded-[2px]',
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
        'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[2px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4CAE4C] disabled:pointer-events-none disabled:opacity-65 font-sans text-center',
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

