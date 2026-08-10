import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

function normalizeBasePath(basePath: string): string {
  if (!basePath.startsWith('/')) {
    return normalizeBasePath(`/${basePath}`);
  }

  return basePath.endsWith('/') ? basePath : `${basePath}/`;
}

const defaultBasePath = '/';
const basePath = normalizeBasePath(process.env.VITE_BASE_PATH ?? defaultBasePath);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET ?? 'https://noise-sensors-dashboard.herokuapp.com';

  return {
    plugins: [react()],
    base: basePath,
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          headers: { Origin: apiProxyTarget },
          secure: apiProxyTarget.startsWith('https://'),
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
      include: ['src/**/*.test.{ts,tsx}'],
      exclude: ['**/node_modules/**', '**/.claude/**'],
    },
  };
});
