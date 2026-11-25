import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select } from '@/Components/ui/Select';

export interface TablePaginationProps {
    total: number;
    fromIdx?: number;
    toIdx?: number;
    perPage: number;
    onPerPageChange: (perPage: number) => void;
    onPrevPage: () => void;
    onNextPage: () => void;
    hasPrev?: boolean;
    hasNext?: boolean;
    currentPage?: number;
    totalPages?: number;
    onPageChange?: (page: number) => void;
    variant?: 'table' | 'grid';
    perPageOptions?: number[];
    itemLabel?: string;
    perPageLabel?: string;
    className?: string;
}

export default function TablePagination({
    total,
    fromIdx = 0,
    toIdx = 0,
    perPage,
    onPerPageChange,
    onPrevPage,
    onNextPage,
    hasPrev = false,
    hasNext = false,
    variant = 'table',
    perPageOptions,
    itemLabel,
    perPageLabel,
    className = '',
}: TablePaginationProps) {
    const isGrid = variant === 'grid';
    const defaultOptions = isGrid
        ? [12, 24, 36, 48, 96]
        : [10, 15, 30, 50, 100];
    const options = perPageOptions || defaultOptions;
    const resolvedItemLabel = itemLabel || (isGrid ? 'items' : 'entries');
    const resolvedPerPageLabel = perPageLabel || (isGrid ? 'Cards per page:' : '');

    const containerClasses = isGrid
        ? `flex items-center justify-between gap-2 px-3 py-1.5 bg-white dark:bg-[#12161c] rounded-[3px] border border-[#ebebeb] dark:border-slate-800 shadow-none font-sans ${className}`
        : `flex items-center justify-between gap-2 px-3 py-1.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#181d24] font-sans ${className}`;

    return (
        <div className={containerClasses}>
            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap min-w-0">
                <span>Showing</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                    {total > 0 ? `${fromIdx}–${toIdx}` : '0'}
                </span>
                <span>of</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                    {total}
                </span>
                <span className="hidden sm:inline">{resolvedItemLabel}</span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                <div className="flex items-center gap-1.5">
                    {resolvedPerPageLabel && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
                            {resolvedPerPageLabel}
                        </span>
                    )}
                    <div className="w-[62px]">
                        <Select
                            size="sm"
                            value={perPage}
                            direction="up"
                            showSearch={false}
                            onChange={(e) =>
                                onPerPageChange(Number(e.target.value))
                            }
                            options={options.map((opt) => ({
                                value: opt,
                                label: String(opt),
                            }))}
                            triggerClassName="h-7 px-2 pr-6 text-[11px] font-bold bg-white dark:bg-[#1e2329]"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onPrevPage}
                        disabled={!hasPrev}
                        aria-label="Previous page"
                        className="h-7 w-7 sm:w-auto sm:px-2 flex items-center justify-center gap-1 text-[11px] font-semibold rounded-[3px] border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-[#1e2329] text-slate-700 dark:text-slate-200 hover:border-[#ff4a1f]/40 hover:text-[#ff4a1f] hover:bg-orange-50/50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:border-slate-200/80 dark:disabled:hover:border-slate-700/60 disabled:hover:text-slate-700 dark:disabled:hover:text-slate-200 disabled:hover:bg-white dark:disabled:hover:bg-[#1e2329] disabled:cursor-not-allowed transition-all shadow-none active:scale-95 cursor-pointer"
                    >
                        <ChevronLeft size={13} />
                        <span className="hidden sm:inline">Prev</span>
                    </button>
                    <button
                        type="button"
                        onClick={onNextPage}
                        disabled={!hasNext}
                        aria-label="Next page"
                        className="h-7 w-7 sm:w-auto sm:px-2 flex items-center justify-center gap-1 text-[11px] font-semibold rounded-[3px] border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-[#1e2329] text-slate-700 dark:text-slate-200 hover:border-[#ff4a1f]/40 hover:text-[#ff4a1f] hover:bg-orange-50/50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:border-slate-200/80 dark:disabled:hover:border-slate-700/60 disabled:hover:text-slate-700 dark:disabled:hover:text-slate-200 disabled:hover:bg-white dark:disabled:hover:bg-[#1e2329] disabled:cursor-not-allowed transition-all shadow-none active:scale-95 cursor-pointer"
                    >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight size={13} />
                    </button>
                </div>
            </div>
        </div>
    );
}

