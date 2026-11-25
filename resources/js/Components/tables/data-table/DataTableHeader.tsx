import React, { useRef, useEffect } from 'react';
import { ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { Column } from './dataTableTypes';

interface DataTableHeaderProps<T = any> {
    showCheckbox: boolean;
    compact: boolean;
    isAllPageSelected: boolean;
    isSomePageSelected?: boolean;
    toggleSelectAll: () => void;
    currentColumns: Column<T>[];
    visibleColumns: string[];
    setOrderedColumnIds: React.Dispatch<React.SetStateAction<string[]>>;
    sortKey: string | null;
    sortDir: 'asc' | 'desc';
    handleSort: (id: string) => void;
    actions?: (item: T) => React.ReactNode;
    actionsColumnClassName?: string;
}

export function DataTableHeader<T = any>({
    showCheckbox,
    compact,
    isAllPageSelected,
    isSomePageSelected = false,
    toggleSelectAll,
    currentColumns,
    visibleColumns,
    setOrderedColumnIds,
    sortKey,
    sortDir,
    handleSort,
    actions,
    actionsColumnClassName,
}: DataTableHeaderProps<T>) {
    const checkboxRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (checkboxRef.current) {
            checkboxRef.current.indeterminate = Boolean(isSomePageSelected);
        }
    }, [isSomePageSelected, isAllPageSelected]);

    const activeVisibleColumns = currentColumns.filter((col) =>
        visibleColumns.includes(col.id)
    );

    return (
        <thead>
            <tr className="bg-[#f8fafc] dark:bg-[#161a22] border-b border-slate-200 dark:border-slate-800 text-[12.5px] font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap select-none">
                {showCheckbox && (
                    <th
                        className={`${compact ? 'px-2 py-2' : 'px-3 py-2.5'} w-[34px] border-r border-slate-200/80 dark:border-slate-800/80`}
                    >
                        <div className="flex items-center justify-center">
                            <input
                                ref={checkboxRef}
                                type="checkbox"
                                checked={isAllPageSelected}
                                onChange={toggleSelectAll}
                                className="table-checkbox cursor-pointer"
                                title={
                                    isAllPageSelected
                                        ? 'Deselect all on this page'
                                        : 'Select all on this page'
                                }
                                aria-label="Select all on this page"
                            />
                        </div>
                    </th>
                )}
                {activeVisibleColumns.map((col, colIdx) => {
                    const isCentered =
                        col.className?.includes('text-center') ||
                        col.className?.includes('justify-center');
                    const isRight =
                        col.className?.includes('text-right') ||
                        col.className?.includes('justify-end');
                    const isLastCol =
                        !actions && colIdx === activeVisibleColumns.length - 1;

                    return (
                        <th
                            key={col.id}
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', col.id);
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                const draggedId =
                                    e.dataTransfer.getData('text/plain');
                                if (draggedId && draggedId !== col.id) {
                                    const order = currentColumns.map(
                                        (c) => c.id
                                    );
                                    const fromIndex = order.indexOf(draggedId);
                                    const toIndex = order.indexOf(col.id);
                                    if (fromIndex !== -1 && toIndex !== -1) {
                                        const newOrder = [...order];
                                        const [removed] = newOrder.splice(
                                            fromIndex,
                                            1
                                        );
                                        newOrder.splice(toIndex, 0, removed);
                                        setOrderedColumnIds(newOrder);
                                    }
                                }
                            }}
                            className={`${compact ? 'px-2.5 py-2 text-[12px]' : 'px-3.5 py-2.5 text-[12.5px]'} font-bold text-slate-800 dark:text-slate-100 ${
                                !isLastCol
                                    ? 'border-r border-slate-200/80 dark:border-slate-800/80'
                                    : ''
                            } ${col.className || ''} ${
                                col.sortable !== false
                                    ? 'cursor-pointer hover:text-slate-950 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                                    : ''
                            }`}
                            onClick={() =>
                                col.sortable !== false && handleSort(col.id)
                            }
                        >
                            <div
                                className={`flex items-center gap-1.5 ${
                                    isCentered
                                        ? 'justify-center'
                                        : isRight
                                          ? 'justify-end'
                                          : 'justify-start'
                                }`}
                            >
                                <span className="tracking-tight">{col.label}</span>
                                {col.sortable !== false &&
                                sortKey === col.id ? (
                                    sortDir === 'asc' ? (
                                        <ChevronUp
                                            size={13}
                                            className="text-[#ff4a1f] stroke-[2.5]"
                                        />
                                    ) : (
                                        <ChevronDown
                                            size={13}
                                            className="text-[#ff4a1f] stroke-[2.5]"
                                        />
                                    )
                                ) : col.sortable !== false ? (
                                    <ChevronsUpDown
                                        size={13}
                                        className="text-slate-500 opacity-60"
                                    />
                                ) : null}
                            </div>
                        </th>
                    );
                })}
                {actions && (
                    <th
                        className={`${compact ? 'px-2.5 py-2 text-[12px]' : 'px-3.5 py-2.5 text-[12.5px]'} text-center font-bold text-slate-800 dark:text-slate-100 ${
                            actionsColumnClassName || 'w-[64px] min-w-[64px]'
                        }`}
                    >
                        Action
                    </th>
                )}
            </tr>
        </thead>
    );
}

