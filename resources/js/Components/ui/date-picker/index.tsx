import * as React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDatePickerState } from './useDatePickerState';
import { DatePickerCalendar } from './DatePickerCalendar';

export interface DatePickerProps {
    id?: string;
    name?: string;
    value?: string | number | readonly string[];
    defaultValue?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    disabled?: boolean;
    readOnly?: boolean;
    required?: boolean;
    min?: string;
    max?: string;
    className?: string;
    error?: string;
    label?: string;
    align?: 'start' | 'center' | 'end';
}

const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
    (
        {
            id,
            name,
            value = '',
            defaultValue,
            onChange,
            placeholder = 'YYYY-MM-DD',
            disabled = false,
            readOnly = false,
            required = false,
            min,
            max,
            className,
            error,
            label,
            align = 'end',
            ...props
        },
        ref
    ) => {
        const [isOpen, setIsOpen] = React.useState(false);
        const [position, setPosition] = React.useState<{
            top?: number;
            bottom?: number;
            left: number;
        }>({ top: 0, left: 0 });
        const containerRef = React.useRef<HTMLDivElement>(null);

        const {
            stringValue,
            viewYear,
            viewMonth,
            setViewYear,
            setViewMonth,
            minDate,
            maxDate,
            isPrevDisabled,
            isNextDisabled,
            handlePrevMonth,
            handleNextMonth,
            isTodayDisabled,
            handleToday,
            handleClear,
            calendarDays,
            yearOptions,
            handleSelectDay,
            triggerChange,
        } = useDatePickerState({
            value,
            defaultValue,
            min,
            max,
            disabled,
            readOnly,
            name,
            onChange,
            setIsOpen,
        });

        const inputId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : name);

        const openPicker = () => {
            if (disabled || readOnly) return;
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const calendarWidth = 280;
                const spaceBelow = window.innerHeight - rect.bottom;
                let left =
                    align === 'end'
                        ? rect.right - calendarWidth
                        : align === 'center'
                          ? rect.left + rect.width / 2 - calendarWidth / 2
                          : rect.left;
                left = Math.max(10, Math.min(left, window.innerWidth - calendarWidth - 10));

                if (spaceBelow < 320 && rect.top > spaceBelow) {
                    setPosition({
                        bottom: window.innerHeight - rect.top + 4,
                        left,
                    });
                } else {
                    setPosition({
                        top: rect.bottom + 4,
                        left,
                    });
                }
            }
            setIsOpen(true);
        };

        React.useEffect(() => {
            if (!isOpen) return;
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') setIsOpen(false);
            };
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }, [isOpen]);

        const renderLabel = (labelStr: string) => {
            if (labelStr.endsWith('*')) {
                const baseText = labelStr.slice(0, -1).trim();
                return (
                    <>
                        {baseText} <span className="text-red-500 font-bold ml-0.5">*</span>
                    </>
                );
            }
            return (
                <>
                    {labelStr}
                    {required && <span className="text-red-500 font-bold ml-0.5">*</span>}
                </>
            );
        };

        return (
            <div className="flex flex-col gap-1 w-full font-sans antialiased">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="text-[13px] font-semibold text-slate-700 dark:text-slate-300"
                    >
                        {renderLabel(label)}
                    </label>
                )}

                <div ref={containerRef} className="relative flex items-center w-full">
                    <input
                        ref={ref}
                        id={inputId}
                        name={name}
                        value={stringValue}
                        onChange={(e) => triggerChange(e.target.value)}
                        onClick={openPicker}
                        onFocus={openPicker}
                        placeholder={placeholder}
                        disabled={disabled}
                        readOnly={readOnly}
                        required={required}
                        className={cn(
                            'block h-[36px] w-full rounded-sm border bg-white dark:bg-[#12161c] px-3 pr-9 py-1 text-[13px] font-normal text-[#202223] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500 shadow-none font-sans cursor-pointer',
                            error
                                ? 'border-[#d82c0d] focus:border-[#d82c0d]'
                                : 'border-slate-300 dark:border-slate-700/80 focus:border-slate-400 dark:focus:border-slate-500',
                            className
                        )}
                        {...props}
                        type="text"
                    />

                    <button
                        type="button"
                        disabled={disabled || readOnly}
                        tabIndex={-1}
                        onClick={() => (isOpen ? setIsOpen(false) : openPicker())}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none"
                    >
                        <CalendarIcon size={15} />
                    </button>
                </div>

                <DatePickerCalendar
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                    position={position}
                    viewYear={viewYear}
                    viewMonth={viewMonth}
                    setViewYear={setViewYear}
                    setViewMonth={setViewMonth}
                    handlePrevMonth={handlePrevMonth}
                    handleNextMonth={handleNextMonth}
                    isPrevDisabled={isPrevDisabled}
                    isNextDisabled={isNextDisabled}
                    minDate={minDate}
                    maxDate={maxDate}
                    yearOptions={yearOptions}
                    calendarDays={calendarDays}
                    handleSelectDay={handleSelectDay}
                    handleClear={handleClear}
                    handleToday={handleToday}
                    isTodayDisabled={isTodayDisabled}
                />

                {error && <span className="text-[12px] text-[#d82c0d] mt-0.5 font-sans">{error}</span>}
            </div>
        );
    }
);

DatePicker.displayName = 'DatePicker';

export default DatePicker;

