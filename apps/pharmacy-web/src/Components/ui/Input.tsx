import * as React from 'react';
import { cn } from '@/lib/cn';
import DatePicker from '@/Components/ui/date-picker';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: string;
    label?: string;
    icon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, error, label, icon, rightIcon, id, required, ...props }, ref) => {
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

        const renderLabel = (labelStr: string) => {
            if (labelStr.endsWith('*')) {
                const baseText = labelStr.slice(0, -1).trim();
                return (
                    <>
                        {baseText} <span className="text-[#C9302C] font-bold ml-0.5">*</span>
                    </>
                );
            }
            return (
                <>
                    {labelStr}
                    {required && <span className="text-[#C9302C] font-bold ml-0.5">*</span>}
                </>
            );
        };

        return (
            <div className="flex flex-col gap-1 w-full font-sans">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="text-[13px] font-semibold text-[#333333] dark:text-slate-200 font-sans"
                    >
                        {renderLabel(label)}
                    </label>
                )}
                <div className="relative flex items-center w-full">
                    {icon && (
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10 text-[#666666] dark:text-slate-400">
                            {icon}
                        </div>
                    )}
                    <input
                        type={type}
                        id={inputId}
                        required={required}
                        className={cn(
                            'block h-[36px] w-full rounded-[2px] border bg-white dark:bg-[#12161c] px-3 py-1 text-[13px] font-normal text-[#333333] dark:text-slate-100 placeholder:text-[#777777] dark:placeholder:text-slate-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[#EDEDED] disabled:text-[#4A4A4A] disabled:border-[#CCCCCC] dark:disabled:bg-slate-800/80 dark:disabled:text-slate-300 read-only:bg-[#EDEDED] read-only:text-[#4A4A4A] dark:read-only:bg-slate-800/60 shadow-none font-sans dark:[color-scheme:dark]',
                            Boolean(icon) && 'pl-9',
                            Boolean(rightIcon) && 'pr-10',
                            error
                                ? 'border-[#C9302C]'
                                : 'border-[#CCCCCC] dark:border-slate-700',
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
                {error && <span className="text-[12px] text-[#d82c0d] mt-0.5 font-sans">{error}</span>}
            </div>
        );
    }
);

Input.displayName = 'Input';

export { Input };
export default Input;

