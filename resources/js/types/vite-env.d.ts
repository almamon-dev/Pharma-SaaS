/// <reference types="vite/client" />

interface ZiggyRouterInstance {
    current(name?: string, params?: Record<string, unknown>): boolean;
    has(name: string): boolean;
}

declare function route(): ZiggyRouterInstance;
declare function route(
    name: string,
    params?:
        | Record<string, string | number | boolean | null | undefined>
        | string
        | number,
    absolute?: boolean
): string;
