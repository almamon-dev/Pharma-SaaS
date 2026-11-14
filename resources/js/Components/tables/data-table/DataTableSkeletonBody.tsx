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
    return (
        <>
            {Array.from({ length: effectiveSkeletonCount }).map((_, rIdx) => (
                <tr key={rIdx} className={rowHeightClass}>
                    {showCheckbox && (
                        <td
                            className={`${cellPaddingClass} w-[36px] min-w-[36px] max-w-[36px] whitespace-nowrap`}
                        >
                            <div className="flex items-center justify-center">
                                <Skeleton className="h-3.5 w-3.5 rounded-[2px]" />
                            </div>
                        </td>
                    )}
                    {currentColumns.map((col) => {
                        if (!visibleColumns.includes(col.id)) return null;

                        if (col.skeleton) {
                            return (
                                <td
                                    key={col.id}
                                    className={`${cellPaddingClass} ${col.className || ''}`}
                                >
                                    {col.skeleton()}
                                </td>
                            );
                        }

                        const isCentered = col.className?.includes('text-center');
                        const isRight = col.className?.includes('text-right');

                        return (
                            <td
                                key={col.id}
                                className={`${cellPaddingClass} ${col.className || ''}`}
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
                            className={`${cellPaddingClass} whitespace-nowrap text-right pr-3.5 sm:pr-4 ${
                                actionsColumnClassName ||
                                'w-[76px] min-w-[70px]'
                            }`}
                        >
                            <div className="flex items-center justify-end gap-1.5 w-full min-h-[26px]">
                                <Skeleton className="h-7 w-7 rounded-[5px]" />
                            </div>
                        </td>
                    )}
                </tr>
            ))}
        </>
    );
}

