import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './', // works at a domain root or under a sub-path (GitHub Pages)
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Cooking App',
        short_name: 'Cooking',
        description: 'Journal repas, calories et plats maison',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#f7f7f5',
        background_color: '#f7f7f5',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only. Supabase data and photos always go to the network: a stale diary would lie.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallbackDenylist: [/^\/auth\//],
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
    }),
  ],
})
