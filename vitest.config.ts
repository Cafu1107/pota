import { defineConfig } from 'vitest/config';

// `npm test` runs the offline unit tests; `npm run test:live` (vitest.live.config.ts) hits the real APIs.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/**/*.live.test.ts', '**/node_modules/**'],
  },
});
