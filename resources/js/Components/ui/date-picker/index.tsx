import * as React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { FieldWrapper, FormLayoutMode } from '@/Components/ui/FormLayout';
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
    layout?: FormLayoutMode;
    labelWidth?: string;
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
            layout,
            labelWidth,
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

        return (
            <FieldWrapper
                label={label}
                htmlFor={inputId}
                required={required}
                error={error}
                layout={layout}
                labelWidth={labelWidth}
            >
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
                            'block h-[30px] w-full rounded-[1px] border bg-white dark:bg-[#12161c] px-2.5 pr-8 py-0.5 text-[12.5px] font-normal text-[#202223] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500 read-only:bg-slate-100 dark:read-only:bg-slate-800/70 read-only:text-slate-600 dark:read-only:text-slate-300 read-only:border-slate-200 dark:read-only:border-slate-700/70 read-only:cursor-default shadow-none font-sans cursor-pointer',
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
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none"
                    >
                        <CalendarIcon size={14} />
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
            </FieldWrapper>
        );
    }
);

DatePicker.displayName = 'DatePicker';

export default DatePicker;

