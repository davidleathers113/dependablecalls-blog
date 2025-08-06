/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

// Plugin to modify CSP for development
const devCSPPlugin = (mode: string) => {
  return {
    name: 'dev-csp-plugin',
    transformIndexHtml(html: string) {
      if (mode === 'development') {
        // Add unsafe-inline to style-src for development
        return html.replace(
          "style-src 'self' 'nonce-__STYLE_NONCE__'",
          "style-src 'self' 'unsafe-inline'"
        ).replace(
          "script-src 'self' 'nonce-__SCRIPT_NONCE__'",
          "script-src 'self' 'unsafe-inline'"
        );
      }
      return html;
    }
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    devCSPPlugin(mode),
    visualizer({
      template: 'treemap',
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html',
    }),
  ],
  // Define global constants replaced at build time
  // This ensures environment variables are properly injected
  define: {
    // Inject environment variables as global constants for production builds
    // These will be replaced with actual values from process.env during build
    ...(mode === 'production' && {
      '__VITE_SUPABASE_URL__': JSON.stringify(process.env.VITE_SUPABASE_URL),
      '__VITE_SUPABASE_ANON_KEY__': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
    })
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Proxy Netlify functions during development
      '/.netlify/functions': {
        target: 'http://localhost:9999',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.log('proxy error', err);
            // Return a mock response for auth-session to prevent errors
            if (_req.url === '/.netlify/functions/auth-session') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: false,
                message: 'No session found',
                user: null,
                session: null,
              }));
            } else {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Netlify functions not running in development' }));
            }
          });
        },
      },
    },
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 500,
    target: 'es2020',
    minify: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-core'
            }
            if (id.includes('react-router-dom') || id.includes('@tanstack/react-query') || id.includes('react-hook-form')) {
              return 'react-ecosystem'
            }
            if (id.includes('@headlessui/react')) {
              return 'ui-headless'
            }
            if (id.includes('@heroicons/react')) {
              return 'ui-icons'
            }
            if (id.includes('@supabase')) {
              return 'supabase'
            }
            if (id.includes('@stripe') || id.includes('stripe')) {
              return 'stripe'
            }
            if (id.includes('zustand')) {
              return 'state'
            }
            if (id.includes('axios')) {
              return 'http'
            }
            if (id.includes('zod') || id.includes('@hookform/resolvers')) {
              return 'validation'
            }
            if (id.includes('lodash') || id.includes('uuid')) {
              return 'utils'
            }
            if (id.includes('@sentry')) {
              return 'monitoring'
            }
            return 'vendor'
          }
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/css/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
}))