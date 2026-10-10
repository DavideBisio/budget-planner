import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      // The pure logic must be well covered; UI code is checked by the e2e tests.
      include: ['src/core/**/*.js'],
      reporter: ['text', 'html'],
      thresholds: { lines: 90 },
    },
  },
});
