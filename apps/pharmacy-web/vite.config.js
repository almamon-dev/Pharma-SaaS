import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
    plugins: [
        laravel({
            input: ['src/styles/app.css', 'src/app.tsx'],
            publicDirectory: '../pharmacy-api/public',
            hotFile: '../pharmacy-api/public/hot',
            refresh: [
                '../pharmacy-api/resources/views/**',
                '../pharmacy-api/routes/**',
            ],
        }),
        react(),
        tailwindcss(),
    ],
    build: {
        emptyOutDir: true,
    },
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, 'src'),
        },
    },
    server: {
        host: '0.0.0.0',
        port: 5174,
        hmr: {
            host: 'localhost',
        },
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
