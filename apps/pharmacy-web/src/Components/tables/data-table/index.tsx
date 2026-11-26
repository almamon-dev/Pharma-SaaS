import React, { useRef, useState } from 'react';
import { Column, DataTableProps } from './dataTableTypes';
import { useDataTableState } from './useDataTableState';
import { DataTableGridSection } from './DataTableGridSection';
import { DataTableToolbarSection } from './DataTableToolbarSection';
import { DataTableHeader } from './DataTableHeader';
import { DataTableSkeletonBody } from './DataTableSkeletonBody';
import { DataTableDataBody } from './DataTableDataBody';
import EmptyState from '@/Components/tables/empty-state';
import TablePagination from '@/Components/tables/table-pagination';

export type { Column, DataTableProps };

export default function DataTable<T extends Record<string, any>>(
    props: DataTableProps<T>
) {
    const {
        columns,
        searchPlaceholder = 'Search...',
        onDeleteSelected,
        keyExtractor = (item: any) => item.id,
        actions,
        filterContent,
        headerTabs,
        compact = true,
        expandableContent,
        hideViewToggle = false,
        hidePagination = false,
        hideToolbar = false,
        isLoading = false,
        emptyState,
        tableClassName,
        tableLayout = 'auto',
        disableHorizontalScroll = false,
        actionsColumnClassName,
        onRowClick,
        hideCheckbox = false,
        selectable = true,
        hideFilter = false,
        banner,
        onRefresh,
        isRefreshing,
        hideColumnToggle = false,
    } = props;

    const showCheckbox = selectable && !hideCheckbox;
    const rowHeightClass = compact ? 'min-h-[34px]' : 'min-h-[46px]';
    const cellPaddingClass = compact ? 'px-2.5 py-1.5' : 'px-3.5 py-2.5';

    const state = useDataTableState(props);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const dragStateRef = useRef<{
        active: boolean;
        moved: boolean;
        startX: number;
        startY: number;
        startScrollLeft: number;
    }>({ active: false, moved: false, startX: 0, startY: 0, startScrollLeft: 0 });
    const [isPanning, setIsPanning] = useState(false);

    const handleScrollMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (disableHorizontalScroll || e.button !== 0) return;
        const el = scrollContainerRef.current;
        if (!el || el.scrollWidth <= el.clientWidth) return;
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, select, textarea, [role="button"], th[draggable="true"]')) {
            return;
        }

        dragStateRef.current = {
            active: true,
            moved: false,
            startX: e.clientX,
            startY: e.clientY,
            startScrollLeft: el.scrollLeft,
        };

        const handleMouseMove = (moveEvt: MouseEvent) => {
            const drag = dragStateRef.current;
            if (!drag.active) return;
            const dx = moveEvt.clientX - drag.startX;
            const dy = moveEvt.clientY - drag.startY;
            if (!drag.moved) {
                if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
                    drag.moved = true;
                    setIsPanning(true);
                } else if (Math.abs(dy) > 6) {
                    drag.active = false;
                    return;
                } else {
                    return;
                }
            }
            el.scrollLeft = drag.startScrollLeft - dx;
            window.getSelection()?.removeAllRanges();
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            const wasMoved = dragStateRef.current.moved;
            dragStateRef.current.active = false;
            setIsPanning(false);
            if (wasMoved) {
                setTimeout(() => {
                    dragStateRef.current.moved = false;
                }, 0);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    if (state.viewMode === 'grid') {
        return <DataTableGridSection props={props} state={state} />;
    }

    return (
        <div className="w-full min-w-0 bg-white dark:bg-[#12161c] rounded-[2px] border border-slate-200 dark:border-slate-800 shadow-none">
            <div className="w-full min-w-0">
                <DataTableToolbarSection
                    headerTabs={headerTabs}
                    banner={banner}
                    hideToolbar={hideToolbar}
                    selectedCount={state.selectedIds.length}
                    totalCount={state.totalItems}
                    onClearSelection={() => state.setSelectedIds([])}
                    onDeleteSelected={
                        onDeleteSelected
                            ? () => onDeleteSelected(state.selectedIds)
                            : undefined
                    }
                    onSelectAll={state.handleSelectAll}
                    search={state.search}
                    setSearch={state.setSearch}
                    searchPlaceholder={searchPlaceholder}
                    hideFilter={hideFilter}
                    showFilters={state.showFilters}
                    setShowFilters={state.setShowFilters}
                    hideViewToggle={hideViewToggle}
                    handleSwitchView={state.handleSwitchView}
                    currentColumns={state.currentColumns}
                    visibleColumns={state.visibleColumns}
                    toggleColumn={state.toggleColumn}
                    handleResetColumns={state.handleResetColumns}
                    isWrapCells={state.isWrapCells}
                    handleToggleWrapCells={state.handleToggleWrapCells}
                    filterContent={filterContent}
                    onRefresh={onRefresh}
                    isRefreshing={isRefreshing}
                    hideColumnToggle={hideColumnToggle}
                />

                {state.paginatedData.length === 0 && !isLoading ? (
                    <div className="bg-white dark:bg-[#12161c]">
                        {emptyState ?? <EmptyState />}
                    </div>
                ) : (
                    <div
                        ref={scrollContainerRef}
                        onMouseDown={handleScrollMouseDown}
                        onClickCapture={(e) => {
                            if (dragStateRef.current.moved) {
                                e.preventDefault();
                                e.stopPropagation();
                            }
                        }}
                        className={
                            disableHorizontalScroll
                                ? 'w-full overflow-hidden'
                                : `w-full max-w-full overflow-x-auto custom-scrollbar ${
                                      isPanning ? 'cursor-grabbing select-none' : ''
                                  }`
                        }
                        onWheel={(e) => {
                            if (disableHorizontalScroll) return;
                            if (e.shiftKey && e.deltaY !== 0) {
                                const el = e.currentTarget;
                                if (el.scrollWidth > el.clientWidth) {
                                    e.preventDefault();
                                    el.scrollLeft += e.deltaY;
                                }
                            }
                        }}
                    >
                        <table
                            className={`w-full text-left border-collapse font-sans ${
                                tableLayout === 'fixed' ? 'table-fixed' : ''
                            } ${
                                state.isWrapCells ? 'table-wrap-cells' : ''
                            } ${tableClassName || ''}`}
                        >
                            <DataTableHeader
                                showCheckbox={showCheckbox}
                                compact={compact}
                                isAllPageSelected={state.isAllPageSelected}
                                isSomePageSelected={state.isSomePageSelected}
                                toggleSelectAll={state.toggleSelectAll}
                                currentColumns={state.currentColumns}
                                visibleColumns={state.visibleColumns}
                                setOrderedColumnIds={state.setOrderedColumnIds}
                                sortKey={state.sortKey}
                                sortDir={state.sortDir}
                                handleSort={state.handleSort}
                                actions={actions}
                                actionsColumnClassName={actionsColumnClassName}
                            />
                            <tbody className="bg-white dark:bg-[#12161c]">
                                {isLoading ? (
                                    <DataTableSkeletonBody
                                        effectiveSkeletonCount={
                                            state.effectiveSkeletonCount
                                        }
                                        rowHeightClass={rowHeightClass}
                                        cellPaddingClass={cellPaddingClass}
                                        showCheckbox={showCheckbox}
                                        currentColumns={state.currentColumns}
                                        visibleColumns={state.visibleColumns}
                                        actions={actions}
                                        actionsColumnClassName={
                                            actionsColumnClassName
                                        }
                                    />
                                ) : (
                                    <DataTableDataBody
                                        paginatedData={state.paginatedData}
                                        keyExtractor={keyExtractor}
                                        isIdSelected={state.isIdSelected}
                                        toggleSelect={state.toggleSelect}
                                        expandableContent={expandableContent}
                                        toggleExpand={state.toggleExpand}
                                        onRowClick={onRowClick}
                                        rowHeightClass={rowHeightClass}
                                        showCheckbox={showCheckbox}
                                        cellPaddingClass={cellPaddingClass}
                                        currentColumns={state.currentColumns}
                                        visibleColumns={state.visibleColumns}
                                        isWrapCells={state.isWrapCells}
                                        actions={actions}
                                        actionsColumnClassName={
                                            actionsColumnClassName
                                        }
                                        expandedRows={state.expandedRows}
                                        columnsCount={columns.length}
                                    />
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {!hidePagination && (
                    <TablePagination
                        total={state.totalItems}
                        fromIdx={state.totalItems > 0 ? state.startIndex + 1 : 0}
                        toIdx={Math.min(
                            state.startIndex + state.activePerPage,
                            state.totalItems
                        )}
                        perPage={state.activePerPage}
                        currentPage={state.validCurrentPage}
                        totalPages={state.totalPages}
                        onPageChange={(p) => state.setCurrentPage(p)}
                        onPerPageChange={(val) => {
                            state.setPerPage(Number(val));
                            state.setCurrentPage(1);
                        }}
                        onPrevPage={() =>
                            state.setCurrentPage((p: number) =>
                                Math.max(1, p - 1)
                            )
                        }
                        onNextPage={() =>
                            state.setCurrentPage((p: number) =>
                                Math.min(state.totalPages, p + 1)
                            )
                        }
                        hasPrev={state.validCurrentPage > 1}
                        hasNext={state.validCurrentPage < state.totalPages}
                        variant="table"
                    />
                )}
            </div>
        </div>
    );
}

