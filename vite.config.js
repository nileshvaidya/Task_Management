import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'WorkSync',
        short_name: 'WorkSync',
        description: 'Task management for small manufacturing/engineering teams, by ASK Info-Solutions LLP.',
        theme_color: '#161826',
        background_color: '#161826',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          // Distinct, more tightly-padded artwork for the maskable slot —
          // the OS crops to a shape (circle, squircle, ...) and only the
          // inner ~80% "safe zone" is guaranteed visible, so the plain
          // 'any' icon above (which fills most of the square) would get
          // its edges clipped if reused here.
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
    exclude: ['e2e/**'],
  },
});
