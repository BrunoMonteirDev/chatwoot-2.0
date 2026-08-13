import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const chatwootTarget = env.VITE_CHATWOOT_PROXY_TARGET || 'http://localhost:3000';
  const chatwootViteTarget = env.VITE_CHATWOOT_VITE_TARGET || 'http://localhost:3036';
  const superAdminProxy = {
    target: chatwootTarget,
    changeOrigin: true,
    configure: (proxy: { on: (event: string, handler: (response: { headers: Record<string, string | string[] | undefined> }) => void) => void }) => {
      proxy.on('proxyRes', (response) => {
        const location = response.headers.location;
        if (typeof location !== 'string' || !location.startsWith(chatwootTarget)) return;
        const url = new URL(location);
        response.headers.location = `${url.pathname}${url.search}${url.hash}`;
      });
    },
  };
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        '/auth': { target: chatwootTarget, changeOrigin: true },
        '/api': { target: chatwootTarget, changeOrigin: true },
        '/cable': { target: chatwootTarget, changeOrigin: true, ws: true },
        '/super_admin': superAdminProxy,
        '/vite-dev': { target: chatwootViteTarget, changeOrigin: true },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
