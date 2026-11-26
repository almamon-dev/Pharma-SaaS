import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { MONTH_NAMES, WEEK_DAYS, CalendarDayItem } from './datePickerUtils';

interface DatePickerCalendarProps {
    isOpen: boolean;
    onClose: () => void;
    position: {
        top?: number;
        bottom?: number;
        left: number;
    };
    viewYear: number;
    viewMonth: number;
    setViewYear: (y: number) => void;
    setViewMonth: (m: number) => void;
    handlePrevMonth: (e: React.MouseEvent) => void;
    handleNextMonth: (e: React.MouseEvent) => void;
    isPrevDisabled: boolean;
    isNextDisabled: boolean;
    minDate: Date | null;
    maxDate: Date | null;
    yearOptions: number[];
    calendarDays: CalendarDayItem[];
    handleSelectDay: (day: number, monthOffset?: number) => void;
    handleClear: (e: React.MouseEvent) => void;
    handleToday: (e: React.MouseEvent) => void;
    isTodayDisabled: boolean;
}

export const DatePickerCalendar: React.FC<DatePickerCalendarProps> = ({
    isOpen,
    onClose,
    position,
    viewYear,
    viewMonth,
    setViewYear,
    setViewMonth,
    handlePrevMonth,
    handleNextMonth,
    isPrevDisabled,
    isNextDisabled,
    minDate,
    maxDate,
    yearOptions,
    calendarDays,
    handleSelectDay,
    handleClear,
    handleToday,
    isTodayDisabled,
}) => {
    const [rendered, setRendered] = React.useState(isOpen);
    const [visible, setVisible] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            setRendered(true);
            let raf2 = 0;
            const raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => {
                    setVisible(true);
                });
            });
            return () => {
                cancelAnimationFrame(raf1);
                cancelAnimationFrame(raf2);
            };
        }

        setVisible(false);
        const timer = window.setTimeout(() => {
            setRendered(false);
        }, 230);
        return () => window.clearTimeout(timer);
    }, [isOpen]);

    if (!rendered) return null;

    const isUp = position.bottom !== undefined;

    return createPortal(
        <>
            {isOpen && (
                <div className="fixed inset-0 z-[999998] bg-transparent" onClick={onClose} />
            )}
            <div
                style={{
                    position: 'fixed',
                    ...(isUp
                        ? { bottom: `${position.bottom}px` }
                        : { top: `${position.top ?? 0}px` }),
                    left: `${position.left}px`,
                    zIndex: 999999,
                }}
                className={cn(
                    'dropdown-smooth-panel w-[280px] rounded-[4px] border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#1a1f26] p-3 shadow-xl shadow-slate-900/10 text-slate-800 dark:text-slate-100 font-sans',
                    isUp ? 'origin-bottom-left' : 'origin-top-left',
                    visible
                        ? 'dropdown-smooth-open'
                        : isUp
                          ? 'dropdown-smooth-closed-up'
                          : 'dropdown-smooth-closed-down'
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-1 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={handlePrevMonth}
                        disabled={isPrevDisabled}
                        className={cn(
                            'h-7 w-7 rounded-[2px] flex items-center justify-center transition-colors cursor-pointer',
                            isPrevDisabled
                                ? 'text-slate-300 dark:text-slate-600 opacity-30 cursor-not-allowed pointer-events-none'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                        )}
                        title="Previous Month"
                    >
                        <ChevronLeft size={16} />
                    </button>

                    <div className="flex items-center gap-1">
                        <select
                            value={viewMonth}
                            onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                            className="text-xs font-bold text-slate-800 dark:text-slate-100 bg-transparent border-0 py-0.5 px-1 rounded-[2px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer focus:outline-none"
                        >
                            {MONTH_NAMES.map((m, idx) => {
                                const isMonthDisabled =
                                    (minDate &&
                                        viewYear === minDate.getFullYear() &&
                                        idx < minDate.getMonth()) ||
                                    (maxDate &&
                                        viewYear === maxDate.getFullYear() &&
                                        idx > maxDate.getMonth()) ||
                                    (minDate && viewYear < minDate.getFullYear()) ||
                                    (maxDate && viewYear > maxDate.getFullYear());

                                return (
                                    <option
                                        key={m}
                                        value={idx}
                                        disabled={Boolean(isMonthDisabled)}
                                        className={cn(
                                            'bg-white dark:bg-[#1a1f26]',
                                            isMonthDisabled
                                                ? 'text-slate-300 dark:text-slate-600'
                                                : 'text-slate-800 dark:text-slate-200'
                                        )}
                                    >
                                        {m}
                                    </option>
                                );
                            })}
                        </select>

                        <select
                            value={viewYear}
                            onChange={(e) => {
                                const newYear = parseInt(e.target.value, 10);
                                setViewYear(newYear);
                                if (
                                    minDate &&
                                    newYear === minDate.getFullYear() &&
                                    viewMonth < minDate.getMonth()
                                ) {
                                    setViewMonth(minDate.getMonth());
                                } else if (
                                    maxDate &&
                                    newYear === maxDate.getFullYear() &&
                                    viewMonth > maxDate.getMonth()
                                ) {
                                    setViewMonth(maxDate.getMonth());
                                }
                            }}
                            className="text-xs font-bold text-slate-800 dark:text-slate-100 bg-transparent border-0 py-0.5 px-1 rounded-[2px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer focus:outline-none"
                        >
                            {yearOptions.map((y) => (
                                <option
                                    key={y}
                                    value={y}
                                    className="bg-white dark:bg-[#1a1f26] text-slate-800 dark:text-slate-200"
                                >
                                    {y}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={handleNextMonth}
                        disabled={isNextDisabled}
                        className={cn(
                            'h-7 w-7 rounded-[2px] flex items-center justify-center transition-colors cursor-pointer',
                            isNextDisabled
                                ? 'text-slate-300 dark:text-slate-600 opacity-30 cursor-not-allowed pointer-events-none'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                        )}
                        title="Next Month"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-1 pt-2 pb-1 text-center">
                    {WEEK_DAYS.map((day) => (
                        <span
                            key={day}
                            className="text-[11px] font-semibold text-slate-400 dark:text-slate-500"
                        >
                            {day}
                        </span>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((c, idx) => (
                        <button
                            key={idx}
                            type="button"
                            disabled={c.isDisabled}
                            onClick={() => !c.isDisabled && handleSelectDay(c.day, c.monthOffset)}
                            className={cn(
                                'h-7 w-full rounded-[2px] text-xs flex items-center justify-center transition-colors select-none',
                                c.isDisabled &&
                                    c.isCurrentMonth &&
                                    'text-slate-400 dark:text-slate-500 cursor-not-allowed pointer-events-none opacity-60 bg-transparent font-normal',
                                c.isDisabled &&
                                    !c.isCurrentMonth &&
                                    'text-slate-300 dark:text-slate-700 cursor-not-allowed pointer-events-none opacity-40 bg-transparent font-normal',
                                !c.isDisabled && 'cursor-pointer',
                                !c.isDisabled &&
                                    !c.isCurrentMonth &&
                                    'text-slate-400 dark:text-slate-500 font-normal opacity-50',
                                !c.isDisabled &&
                                    c.isCurrentMonth &&
                                    !c.isSelected &&
                                    'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium',
                                !c.isDisabled &&
                                    c.isToday &&
                                    !c.isSelected &&
                                    'border border-[#0E5F3F] font-bold text-[#0E5F3F] dark:text-[#34D399]',
                                !c.isDisabled &&
                                    c.isSelected &&
                                    'bg-[#0E5F3F] text-white font-bold hover:bg-[#0A4D33] shadow-sm'
                            )}
                        >
                            {c.day}
                        </button>
                    ))}
                </div>

                <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <button
                        type="button"
                        onClick={handleClear}
                        className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 px-1.5 py-0.5 rounded-[2px] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        Clear
                    </button>
                    <button
                        type="button"
                        disabled={isTodayDisabled}
                        onClick={handleToday}
                        className={cn(
                            'text-[11px] font-bold px-1.5 py-0.5 rounded-[2px] transition-colors',
                            isTodayDisabled
                                ? 'text-slate-300 dark:text-slate-600 opacity-30 cursor-not-allowed pointer-events-none'
                                : 'text-[#0E5F3F] hover:text-[#0A4D33] dark:text-[#34D399] hover:bg-[#EAF5F0] dark:hover:bg-emerald-950/40 cursor-pointer'
                        )}
                    >
                        Today
                    </button>
                </div>
            </div>
        </>,
        document.body
    );
};

