import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // The API tests build the app once before they run.
    hookTimeout: 300_000,
    testTimeout: 30_000
  }
})
