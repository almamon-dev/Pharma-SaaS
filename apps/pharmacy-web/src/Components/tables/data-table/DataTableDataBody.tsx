import React from 'react';
import { Column } from './dataTableTypes';

interface DataTableDataBodyProps<T = any> {
    paginatedData: T[];
    keyExtractor: (item: T) => number | string;
    isIdSelected: (id: number | string) => boolean;
    toggleSelect: (id: number | string) => void;
    expandableContent?: (item: T) => React.ReactNode;
    toggleExpand: (id: number | string) => void;
    onRowClick?: (item: T) => void;
    rowHeightClass: string;
    showCheckbox: boolean;
    cellPaddingClass: string;
    currentColumns: Column<T>[];
    visibleColumns: string[];
    isWrapCells: boolean;
    actions?: (item: T) => React.ReactNode;
    actionsColumnClassName?: string;
    expandedRows: Set<number | string>;
    columnsCount: number;
}

export function DataTableDataBody<T extends Record<string, any>>({
    paginatedData,
    keyExtractor,
    isIdSelected,
    toggleSelect,
    expandableContent,
    toggleExpand,
    onRowClick,
    rowHeightClass,
    showCheckbox,
    cellPaddingClass,
    currentColumns,
    visibleColumns,
    isWrapCells,
    actions,
    actionsColumnClassName,
    expandedRows,
    columnsCount,
}: DataTableDataBodyProps<T>) {
    const activeVisibleColumns = currentColumns.filter((col) =>
        visibleColumns.includes(col.id)
    );

    return (
        <>
            {paginatedData.map((item, index) => {
                const id = keyExtractor(item);
                const isSelected = isIdSelected(id);
                const isEven = index % 2 === 1;
                const rowBg = isSelected
                    ? 'bg-[#EAF5F0] dark:bg-[#0E5F3F]/15'
                    : isEven
                    ? 'bg-[#f8fafc] dark:bg-[#161a22]'
                    : 'bg-white dark:bg-[#12161c]';

                return (
                    <React.Fragment key={id}>
                        <tr
                            onClick={(e) => {
                                if (
                                    (e.target as HTMLElement).closest(
                                        'button, a, input, select, [role="button"], [data-no-click]'
                                    )
                                ) {
                                    return;
                                }
                                if (expandableContent) {
                                    toggleExpand(id);
                                } else if (onRowClick) {
                                    onRowClick(item);
                                }
                            }}
                            className={`transition-colors group border-b border-slate-200/80 dark:border-slate-800/80 ${rowHeightClass} ${rowBg} hover:bg-slate-100/70 dark:hover:bg-slate-800/60 ${
                                expandableContent || onRowClick
                                    ? 'cursor-pointer'
                                    : ''
                            }`}
                        >
                            {showCheckbox && (
                                <td
                                    className={`${cellPaddingClass} w-[36px] min-w-[36px] max-w-[36px] whitespace-nowrap border-r border-slate-200/80 dark:border-slate-800/80`}
                                >
                                    <div className="flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                toggleSelect(id);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="table-checkbox"
                                        />
                                    </div>
                                </td>
                            )}
                            {activeVisibleColumns.map((col, colIdx) => {
                                const isLastCell =
                                    !actions &&
                                    colIdx === activeVisibleColumns.length - 1;
                                const isNoWrapCol =
                                    col.className?.includes(
                                        'whitespace-nowrap'
                                    ) ||
                                    col.id === 'status' ||
                                    col.id === 'date';
                                const cellWrapClass =
                                    isWrapCells && !isNoWrapCol
                                        ? 'whitespace-normal break-words align-top'
                                        : col.className?.includes(
                                                'whitespace-normal'
                                            )
                                          ? 'whitespace-normal break-words'
                                          : 'whitespace-nowrap';

                                return (
                                    <td
                                        key={col.id}
                                        className={`${cellPaddingClass} ${cellWrapClass} font-sans text-[13px] font-normal text-[#333333] dark:text-slate-200 ${
                                            !isLastCell
                                                ? 'border-r border-slate-200/80 dark:border-slate-800/80'
                                                : ''
                                        } ${col.className || ''}`}
                                    >
                                        {col.render
                                            ? col.render(item, index)
                                            : item[col.id]}
                                    </td>
                                );
                            })}
                            {actions && (
                                <td
                                    className={`${cellPaddingClass} whitespace-nowrap text-center ${
                                        actionsColumnClassName ||
                                        'w-[64px] min-w-[64px]'
                                    }`}
                                >
                                    <div className="flex items-center justify-center gap-1.5 w-full min-h-[26px]">
                                        {actions(item)}
                                    </div>
                                </td>
                            )}
                        </tr>
                        {expandableContent && expandedRows.has(id) && (
                            <tr className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                                <td
                                    colSpan={
                                        columnsCount +
                                        (actions ? 1 : 0) +
                                        (showCheckbox ? 1 : 0)
                                    }
                                    className="p-0 border-l-4 border-l-[#0E5F3F]"
                                >
                                    {expandableContent(item)}
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
}

