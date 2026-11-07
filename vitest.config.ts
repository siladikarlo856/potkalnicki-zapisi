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
          exclude: ['test/**/*.nuxt.test.ts', 'test/**/*.serial.integration.test.ts', 'test/**/*.last.integration.test.ts'],
          // Server tests share one Nuxt build per run (test/support/nuxtServer.ts).
          globalSetup: ['test/support/globalSetup.ts'],
          hookTimeout: 300_000,
          testTimeout: 30_000
        }
      },
      {
        // Integration files that need whole tables to themselves (the daily word reads every active word and
        // every scheduled day, the sitemap lists all published content). They run one at a time, after
        // every other file, so nothing else writes to the shared test database meanwhile.
        test: {
          name: 'node-serial',
          include: ['test/**/*.serial.integration.test.ts'],
          fileParallelism: false,
          sequence: { groupOrder: 1 },
          globalSetup: ['test/support/globalSetup.ts'],
          hookTimeout: 300_000,
          testTimeout: 30_000
        }
      },
      {
        // Integration files that publish content they never remove (the inbox applies Proposals). They run one
        // at a time after the serial files, so their rows cannot change what the sitemap or the home counts see.
        test: {
          name: 'node-last',
          include: ['test/**/*.last.integration.test.ts'],
          fileParallelism: false,
          sequence: { groupOrder: 2 },
          globalSetup: ['test/support/globalSetup.ts'],
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
