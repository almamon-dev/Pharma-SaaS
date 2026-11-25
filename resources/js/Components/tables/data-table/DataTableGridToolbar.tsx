import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/Components/ui/Input';
import { Column } from './dataTableTypes';
import TableFilter from '@/Components/tables/table-filter';
import TableColumnToggle from '@/Components/tables/table-column-toggle';
import TableSortDropdown from '@/Components/tables/table-sort-dropdown';
import { DataTableBulkActionOverlay } from './DataTableBulkActionOverlay';
import { TableViewSwitchButtons } from './TableViewSwitchButtons';

interface DataTableGridToolbarProps<T = any> {
    selectedIds: (number | string)[];
    totalItems: number;
    handleSelectAll: () => void;
    onDeleteSelected?: (selectedIds: (number | string)[]) => void;
    setSelectedIds: (ids: (number | string)[]) => void;
    headerTabs?: React.ReactNode;
    isSearchOpen: boolean;
    setIsSearchOpen: (open: boolean) => void;
    search: string;
    setSearch: (val: string) => void;
    searchPlaceholder: string;
    columns: Column<T>[];
    sortKey: string | null;
    sortDir: 'asc' | 'desc';
    setSortKey: (k: string | null) => void;
    setSortDir: (d: 'asc' | 'desc') => void;
    setCurrentPage: (p: number) => void;
    hideFilter?: boolean;
    showFilters: boolean;
    setShowFilters: (val: boolean | ((prev: boolean) => boolean)) => void;
    hideViewToggle?: boolean;
    handleSwitchView: (mode: 'table' | 'grid') => void;
    currentColumns: Column<T>[];
    visibleColumns: string[];
    toggleColumn: (id: string) => void;
    handleResetColumns: () => void;
    isWrapCells: boolean;
    handleToggleWrapCells: (val: boolean) => void;
    filterContent?: React.ReactNode;
}

export function DataTableGridToolbar<T = any>({
    selectedIds,
    totalItems,
    handleSelectAll,
    onDeleteSelected,
    setSelectedIds,
    headerTabs,
    isSearchOpen,
    setIsSearchOpen,
    search,
    setSearch,
    searchPlaceholder,
    columns,
    sortKey,
    sortDir,
    setSortKey,
    setSortDir,
    setCurrentPage,
    hideFilter,
    showFilters,
    setShowFilters,
    hideViewToggle,
    handleSwitchView,
    currentColumns,
    visibleColumns,
    toggleColumn,
    handleResetColumns,
    isWrapCells,
    handleToggleWrapCells,
    filterContent,
}: DataTableGridToolbarProps<T>) {
    return (
        <div className="bg-white dark:bg-[#12161c] rounded-[3px] border border-slate-200 dark:border-slate-800 shadow-none">
            <div className="relative z-10">
                <DataTableBulkActionOverlay
                    selectedCount={selectedIds.length}
                    totalItems={totalItems}
                    onSelectAll={handleSelectAll}
                    onDeleteSelected={
                        onDeleteSelected
                            ? () => onDeleteSelected(selectedIds)
                            : undefined
                    }
                    onClearSelection={() => setSelectedIds([])}
                />

                <div
                    className={`px-3.5 py-2 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        selectedIds.length > 0
                            ? 'opacity-0 pointer-events-none'
                            : 'opacity-100'
                    }`}
                >
                    <div className="flex-1 min-w-0 overflow-x-auto hide-scrollbar">
                        {headerTabs ? (
                            <div className="pt-0.5">{headerTabs}</div>
                        ) : (
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span>{totalItems} total items</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 justify-end flex-wrap sm:flex-nowrap">
                        {isSearchOpen ? (
                            <div className="w-[150px] sm:w-[240px]">
                                <Input
                                    type="text"
                                    autoFocus
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape' && !search)
                                            setIsSearchOpen(false);
                                    }}
                                    placeholder={searchPlaceholder}
                                    icon={<Search size={13} className="text-slate-400" />}
                                    rightIcon={
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearch('');
                                                setIsSearchOpen(false);
                                            }}
                                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer flex items-center"
                                            title="Close search"
                                        >
                                            <X size={13} />
                                        </button>
                                    }
                                    className="h-[32px] pr-8 border-[#ff4a1f]/80 dark:border-[#ff4a1f]/80 text-[12px] font-medium bg-slate-50/50 dark:bg-[#1e2329] text-slate-900 dark:text-slate-200"
                                />
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setIsSearchOpen(true)}
                                className={`h-[32px] w-[32px] flex items-center justify-center rounded-[3px] border border-slate-200/80 dark:border-slate-700/60 bg-slate-50/50 dark:bg-[#1e2329] text-slate-600 dark:text-slate-300 hover:border-[#ff4a1f]/50 hover:text-[#ff4a1f] hover:bg-orange-50/40 dark:hover:bg-slate-800 transition-all cursor-pointer ${
                                    search
                                        ? 'border-[#ff4a1f] text-[#ff4a1f]'
                                        : ''
                                }`}
                                title="Search"
                            >
                                <Search
                                    size={14}
                                    className={
                                        search
                                            ? 'text-[#ff4a1f]'
                                            : 'text-slate-500 dark:text-slate-400'
                                    }
                                />
                            </button>
                        )}

                        <TableSortDropdown
                            columns={columns}
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSortChange={(key) => {
                                setSortKey(key);
                                setCurrentPage(1);
                            }}
                            onSortDirChange={(dir) => {
                                setSortDir(dir);
                                setCurrentPage(1);
                            }}
                        />

                        {!hideFilter && (
                            <>
                                <TableFilter
                                    onFilterClick={() =>
                                        setShowFilters(!showFilters)
                                    }
                                    onResetClick={() => {
                                        setSearch('');
                                        setShowFilters(false);
                                    }}
                                    isFilterOpen={showFilters}
                                    isFiltered={Boolean(search)}
                                />
                                {!hideViewToggle && (
                                    <div className="w-[1px] h-4 bg-slate-200/60 dark:bg-slate-800 mx-0.5 hidden sm:block" />
                                )}
                            </>
                        )}

                        <TableViewSwitchButtons
                            viewMode="grid"
                            onSwitchView={handleSwitchView}
                            hideViewToggle={hideViewToggle}
                        />

                        <TableColumnToggle
                            columns={currentColumns}
                            visibleColumns={visibleColumns}
                            onToggleColumn={toggleColumn}
                            onResetColumns={handleResetColumns}
                            wrapCells={isWrapCells}
                            onToggleWrapCells={handleToggleWrapCells}
                        />
                    </div>
                </div>
            </div>

            {showFilters && filterContent && (
                <div className="p-4 border-t border-[#ebebeb] dark:border-slate-800 bg-[#fcfcfc] dark:bg-[#181d24]">
                    {filterContent}
                </div>
            )}
        </div>
    );
}

