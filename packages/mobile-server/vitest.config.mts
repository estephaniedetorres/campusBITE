import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    // Each test file gets its own temporary database (see tests/setup.ts)
    pool: 'forks',
    testTimeout: 20000,
  },
});
