/** @type {import('jest').Config} */
export default {
  displayName: 'Call Tracking Tests',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/services/call-tracking'],
  testMatch: [
    '<rootDir>/src/services/call-tracking/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/services/call-tracking/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/src/services/call-tracking/__tests__/setup.ts'],
  collectCoverageFrom: [
    'src/services/call-tracking/**/*.{js,jsx,ts,tsx}',
    '!src/services/call-tracking/**/*.d.ts',
    '!src/services/call-tracking/**/__tests__/**',
    '!src/services/call-tracking/**/*.test.{js,jsx,ts,tsx}',
    '!src/services/call-tracking/**/*.spec.{js,jsx,ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'html', 'json', 'lcov'],
  coverageDirectory: '<rootDir>/coverage/call-tracking',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 30000,
  maxWorkers: '50%',
  clearMocks: true,
  restoreMocks: true,
};