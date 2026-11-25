import React from 'react';
import Skeleton from '@/Components/ui/Skeleton';
import { Column } from './dataTableTypes';

interface DataTableSkeletonBodyProps<T = any> {
    effectiveSkeletonCount: number;
    rowHeightClass: string;
    cellPaddingClass: string;
    showCheckbox: boolean;
    currentColumns: Column<T>[];
    visibleColumns: string[];
    actions?: (item: T) => React.ReactNode;
    actionsColumnClassName?: string;
}

export function DataTableSkeletonBody<T = any>({
    effectiveSkeletonCount,
    rowHeightClass,
    cellPaddingClass,
    showCheckbox,
    currentColumns,
    visibleColumns,
    actions,
    actionsColumnClassName,
}: DataTableSkeletonBodyProps<T>) {
    const activeVisibleColumns = currentColumns.filter((col) =>
        visibleColumns.includes(col.id)
    );

    return (
        <>
            {Array.from({ length: effectiveSkeletonCount }).map((_, rIdx) => {
                const isEven = rIdx % 2 === 1;
                const rowBg = isEven
                    ? 'bg-[#f8fafc] dark:bg-[#161a22]'
                    : 'bg-white dark:bg-[#12161c]';

                return (
                    <tr
                        key={rIdx}
                        className={`${rowHeightClass} ${rowBg} border-b border-slate-200/80 dark:border-slate-800/80`}
                    >
                        {showCheckbox && (
                            <td
                                className={`${cellPaddingClass} w-[36px] min-w-[36px] max-w-[36px] whitespace-nowrap border-r border-slate-200/80 dark:border-slate-800/80`}
                            >
                                <div className="flex items-center justify-center">
                                    <Skeleton className="h-3.5 w-3.5 rounded-[2px]" />
                                </div>
                            </td>
                        )}
                        {activeVisibleColumns.map((col, colIdx) => {
                            const isLastCol =
                                !actions &&
                                colIdx === activeVisibleColumns.length - 1;

                            if (col.skeleton) {
                                return (
                                    <td
                                        key={col.id}
                                        className={`${cellPaddingClass} ${
                                            !isLastCol
                                                ? 'border-r border-slate-200/80 dark:border-slate-800/80'
                                                : ''
                                        } ${col.className || ''}`}
                                    >
                                        {col.skeleton()}
                                    </td>
                                );
                            }

                            const isCentered =
                                col.className?.includes('text-center');
                            const isRight =
                                col.className?.includes('text-right');

                            return (
                                <td
                                    key={col.id}
                                    className={`${cellPaddingClass} ${
                                        !isLastCol
                                            ? 'border-r border-slate-200/80 dark:border-slate-800/80'
                                            : ''
                                    } ${col.className || ''}`}
                                >
                                    <div
                                        className={`flex ${
                                            isCentered
                                                ? 'justify-center'
                                                : isRight
                                                  ? 'justify-end'
                                                  : 'items-center'
                                        } items-center min-h-[26px]`}
                                    >
                                        <Skeleton className="h-3.5 w-20 rounded-[3px]" />
                                    </div>
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
                                    <Skeleton className="h-7 w-7 rounded-[5px]" />
                                </div>
                            </td>
                        )}
                    </tr>
                );
            })}
        </>
    );
}

