import { defineConfig } from 'vitest/config';

// Smoke test against the real upstream APIs through the local proxy (needs network).
export default defineConfig({
  test: {
    include: ['tests/**/*.live.test.ts'],
    testTimeout: 120_000,
  },
});
