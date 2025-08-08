/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import compression from 'vite-plugin-compression'

// Plugin to modify CSP for development
// ⚠️ SECURITY: This plugin relaxes CSP in development only - ensure mode validation
const devCSPPlugin = (mode: string) => {
  return {
    name: 'dev-csp-plugin',
    transformIndexHtml(html: string) {
      // Double-check mode to prevent CSP bypass in production
      if (mode === 'development') {
        // Add unsafe-inline to style-src for development
        return html
          .replace("style-src 'self' 'nonce-__STYLE_NONCE__'", "style-src 'self' 'unsafe-inline'")
          .replace(
            "script-src 'self' 'nonce-__SCRIPT_NONCE__'",
            "script-src 'self' 'unsafe-inline'"
          )
      }
      return html
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load environment variables with VITE_ prefix
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [
      react(),
      devCSPPlugin(mode),
      // Bundle analyzer - only run when ANALYZE=true to save ~2s in CI builds
      ...(process.env.ANALYZE
        ? [
            visualizer({
              template: 'treemap',
              open: false,
              gzipSize: true,
              brotliSize: true,
              filename: 'dist/stats.html',
            }),
          ]
        : []),
      // Compression plugins for production
      // TODO: Consider upgrading to vite-plugin-compression2 for unified config
      ...(mode === 'production'
        ? [
            compression({ algorithm: 'gzip' }),
            compression({ algorithm: 'brotliCompress', ext: '.br' }),
          ]
        : []),
    ],
    // Define global constants replaced at build time
    // This ensures environment variables are properly injected
    define: {
      // Inject environment variables as global constants for production builds
      // Use loadEnv to prevent undefined serialization and ensure proper loading
      ...(mode === 'production' && {
        __VITE_SUPABASE_URL__: JSON.stringify(env.VITE_SUPABASE_URL),
        __VITE_SUPABASE_ANON_KEY__: JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      }),
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
              // Only log proxy errors in development mode to prevent stack trace exposure
              if (mode === 'development') {
                console.log('proxy error', err.message || err)
              }
              // Return a mock response for auth-session to prevent errors
              if (_req.url === '/.netlify/functions/auth-session') {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(
                  JSON.stringify({
                    success: false,
                    message: 'No session found',
                    user: null,
                    session: null,
                  })
                )
              } else {
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'Netlify functions not running in development' }))
              }
            })
          },
        },
      },
    },
    build: {
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 500,
      target: 'es2022', // Updated for better performance
      minify: mode === 'production' ? 'terser' : false,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
        output: {
          manualChunks(id) {
            // Optimized chunking strategy: 4-6 strategic chunks to minimize HTTP/2 stream stalls
            // Reduces chunk count from 13+ to 6 for better performance
            if (id.includes('node_modules')) {
              // Core React dependencies + router (most critical, loads first)
              if (id.match(/react|react-dom|react-router-dom/)) {
                return 'vendor'
              }

              // Backend services (Supabase, Stripe, Sentry, HTTP clients)
              if (id.match(/@supabase|@stripe|stripe|@sentry|axios|ky/)) {
                return 'services'
              }

              // UI components and validation (Headless UI, Heroicons, forms, validation)
              if (id.match(/@headlessui|@heroicons|@hookform|zod|validator|react-hook-form/)) {
                return 'ui'
              }

              // State management and data processing
              if (id.match(/zustand|immer|@tanstack\/react-query/)) {
                return 'state'
              }

              // Utilities and performance monitoring
              if (id.match(/lodash|uuid|date-fns|web-vitals|performance|fuse|search/)) {
                return 'utils'
              }

              // All other vendor libraries (fallback)
              return 'vendor'
            }
          },
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId
              ? chunkInfo.facadeModuleId.split('/').pop()
              : 'chunk'
            return `assets/js/${chunkInfo.name || facadeModuleId}-[hash].js`
          },
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'assets/css/[name]-[hash][extname]'
            }
            return 'assets/[name]-[hash][extname]'
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  }
})
