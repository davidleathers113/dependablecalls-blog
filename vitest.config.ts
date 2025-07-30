import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'netlify/functions/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'src/test/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        'src/types/__tests__/**',
      ],
      include: ['src/**/*.{ts,tsx}'],
      all: true,
      lines: 90,
      functions: 90,
      branches: 85,
      statements: 90,
      // Type coverage specific settings
      extension: ['.ts', '.tsx'],
      watermarks: {
        lines: [85, 95],
        functions: [85, 95],
        branches: [80, 90],
        statements: [85, 95],
      },
    },
    // Type testing specific configuration
    typecheck: {
      tsconfig: './tsconfig.json',
      include: ['**/*.{test,spec}-d.{ts,tsx}', '**/types/__tests__/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})