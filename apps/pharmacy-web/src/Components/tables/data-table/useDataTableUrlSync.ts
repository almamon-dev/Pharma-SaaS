import { useRef, useEffect } from 'react';

interface UseDataTableUrlSyncProps {
    syncUrlParams: boolean;
    viewMode: 'table' | 'grid';
    currentPage: number;
    perPage: number;
}

export function useDataTableUrlSync({
    syncUrlParams,
    viewMode,
    currentPage,
    perPage,
}: UseDataTableUrlSyncProps) {
    const isFirstMount = useRef(true);

    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }
        if (!syncUrlParams || typeof window === 'undefined') return;

        const next = new URLSearchParams(window.location.search);
        if (viewMode === 'grid') next.set('view', 'grid');
        else next.delete('view');

        if (currentPage > 1) next.set('page', String(currentPage));
        else next.delete('page');

        const defaultPerPage = viewMode === 'grid' ? 12 : 10;
        if (perPage !== defaultPerPage) next.set('per_page', String(perPage));
        else next.delete('per_page');

        const qs = next.toString();
        const nextUrl = qs
            ? `${window.location.pathname}?${qs}`
            : window.location.pathname;
        window.history.replaceState(window.history.state, '', nextUrl);
    }, [viewMode, currentPage, perPage, syncUrlParams]);
}

