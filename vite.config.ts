import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'icon.svg',
        'launchericon-192x192.png',
        'launchericon-512x512.png',
      ],
      manifest: {
        id: 'com.aizabiz.trading.terminal',
        name: 'AIZABIZ PRO Trading Terminal',
        short_name: 'AIZABIZ',
        description: 'Professional Live Algorithmic Trading & Analysis Terminal for Android & Web',
        theme_color: '#0f172a',
        background_color: '#090d16',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/?source=pwa',
        scope: '/',
        icons: [
          {
            src: '/launchericon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/launchericon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/launchericon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: false,
    // Dev/preview tunnels (Agent Canvas, VS Code forwards, ngrok) send their own Host header.
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.all-hands.dev',
      '.prod-runtime.all-hands.dev',
      ...(process.env.VITE_ALLOWED_HOSTS?.split(',').filter(Boolean) ?? []),
    ],
    hmr: {
      host: 'localhost',
      port: 3000,
    },
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'charts-vendor': ['recharts', 'd3', 'lightweight-charts'],
          'ui-vendor': ['lucide-react', 'motion'],
        },
      },
    },
  },
});
