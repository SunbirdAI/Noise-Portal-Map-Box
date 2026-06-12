import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiProxyTarget = 'https://noise-sensors-dashboard.herokuapp.com';

function normalizeBasePath(basePath: string): string {
  if (!basePath.startsWith('/')) {
    return normalizeBasePath(`/${basePath}`);
  }

  return basePath.endsWith('/') ? basePath : `${basePath}/`;
}

const defaultBasePath = '/Noise-Portal-Map-Box/';
const basePath = normalizeBasePath(process.env.VITE_BASE_PATH ?? defaultBasePath);

export default defineConfig({
  plugins: [react()],
  base: basePath,
  server: {
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ''),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1900,
    rollupOptions: {
      output: {
        manualChunks: {
          mapbox: ['mapbox-gl'],
          charts: ['recharts'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
