/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      template: 'treemap',
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html',
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 500,
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-core': ['react', 'react-dom'],
          'react-ecosystem': ['react-router-dom', '@tanstack/react-query', 'react-hook-form'],
          'ui': ['@headlessui/react', '@heroicons/react'],
          'supabase': ['@supabase/supabase-js'],
          'utils': ['lodash', 'uuid', 'zod'],
          'monitoring': ['@sentry/react']
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})