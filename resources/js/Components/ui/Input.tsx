import DatePicker from '@/Components/ui/date-picker';
import { FieldWrapper, FormLayoutMode } from '@/Components/ui/FormLayout';
import { cn } from '@/lib/cn';
import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: string;
    label?: string;
    icon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    layout?: FormLayoutMode;
    labelWidth?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    (
        {
            className,
            type,
            error,
            label,
            icon,
            rightIcon,
            id,
            required,
            layout,
            labelWidth,
            ...props
        },
        ref
    ) => {
        const inputId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

        if (type === 'date') {
            return (
                <DatePicker
                    ref={ref}
                    id={inputId}
                    label={label}
                    error={error}
                    className={className}
                    required={required}
                    layout={layout}
                    labelWidth={labelWidth}
                    min={typeof props.min === 'string' ? props.min : undefined}
                    max={typeof props.max === 'string' ? props.max : undefined}
                    value={props.value}
                    defaultValue={typeof props.defaultValue === 'string' ? props.defaultValue : undefined}
                    onChange={props.onChange}
                    disabled={props.disabled}
                    readOnly={props.readOnly}
                    name={props.name}
                    placeholder={props.placeholder}
                />
            );
        }

        return (
            <FieldWrapper
                label={label}
                htmlFor={inputId}
                required={required}
                error={error}
                layout={layout}
                labelWidth={labelWidth}
            >
                <div className="relative flex items-center w-full">
                    {icon && (
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10 text-gray-400 dark:text-slate-500">
                            {icon}
                        </div>
                    )}
                    <input
                        type={type}
                        id={inputId}
                        required={required}
                        className={cn(
                            'block h-[30px] w-full rounded-[2px] border bg-white dark:bg-[#12161c] px-2.5 py-0.5 text-[12.5px] font-normal text-[#202223] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500 read-only:bg-slate-100 dark:read-only:bg-slate-800/70 read-only:text-slate-600 dark:read-only:text-slate-300 read-only:border-slate-200 dark:read-only:border-slate-700/70 read-only:focus:border-slate-200 dark:read-only:focus:border-slate-700/70 read-only:cursor-default shadow-none font-sans antialiased dark:[color-scheme:dark]',
                            Boolean(icon) && 'pl-9',
                            Boolean(rightIcon) && 'pr-10',
                            error
                                ? 'border-[#d82c0d]'
                                : 'border-slate-300 dark:border-slate-700/80 focus:border-slate-400 dark:focus:border-slate-500',
                            className
                        )}
                        ref={ref}
                        {...props}
                    />
                    {rightIcon && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center z-10">
                            {rightIcon}
                        </div>
                    )}
                </div>
            </FieldWrapper>
        );
    }
);

Input.displayName = 'Input';

export { Input };
export default Input;
