module.exports = {
  // Include both legacy __tests__ directory and the newer tests directory
  testMatch: ['**/__tests__/**/*.test.js', '**/tests/**/*.test.js', '**/tests/**/*.test.ts'],
  // Exclude base-mini-app, verified-dm-demo, and node_modules from testing
  testPathIgnorePatterns: ['/node_modules/', '/base-mini-app/', '/apps/verified-dm-demo/'],
  coveragePathIgnorePatterns: ['/node_modules/', '/base-mini-app/', '/apps/verified-dm-demo/'],
  // Run in a single process to avoid stateful test interference
  maxWorkers: 1,
  setupFilesAfterEnv: ['jest-fetch-mock', '<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^(?!.*\\.(ts|tsx)$).+\\.[tj]sx?$': '<rootDir>/jest.transform.js',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testEnvironment: 'node',
  resetModules: true,
  reporters: [
    'default',
    ['<rootDir>/tools/testSummaryReporter.js', { output: './logs/test-report.json' }],
  ],
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
};
