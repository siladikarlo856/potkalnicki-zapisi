import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(async () => ({
  resolve: {
    alias: {
      '~~/': `${rootDir}/`,
      '~/': `${rootDir}/app/`
    }
  },
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['test/**/*.test.ts'],
          exclude: ['test/**/*.nuxt.test.ts'],
          // The API tests build the app once before they run.
          hookTimeout: 300_000,
          testTimeout: 30_000
        }
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/**/*.nuxt.test.ts'],
          testTimeout: 30_000
        }
      })
    ]
  }
}))
