// One production Nuxt build per Vitest run, shared by every server test file.
// Each file still starts its own server with its own runtime env (NUXT_* vars),
// so only the build is shared, which used to take about a minute per file.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { beforeAll } from 'vitest'
import { buildFixture, createTestContext, loadFixture, setTestContext, setup, useTestContext } from '@nuxt/test-utils/e2e'

import { doneFile, lockDir, rootDir, sharedBuildDir } from './sharedBuild'

const timeout = 300_000

async function ensureSharedBuild() {
  const deadline = Date.now() + timeout
  mkdirSync(dirname(lockDir), { recursive: true })
  while (!existsSync(doneFile)) {
    try {
      mkdirSync(lockDir) // atomic: exactly one worker builds
    } catch {
      if (Date.now() > deadline) throw new Error(`Timed out waiting for the shared Nuxt build (${lockDir})`)
      await new Promise(done => setTimeout(done, 500))
      continue
    }
    try {
      if (existsSync(doneFile)) return
      setTestContext(createTestContext({ rootDir, buildDir: sharedBuildDir, server: true, build: true }))
      await loadFixture()
      await buildFixture()
      await useTestContext().nuxt?.close()
      writeFileSync(doneFile, new Date().toISOString())
    } finally {
      setTestContext(undefined)
      rmSync(lockDir, { recursive: true, force: true })
    }
  }
}

/** Start this file's Nuxt server from the shared build with the given runtime env. */
export async function setupNuxtServer(env: Record<string, string>) {
  beforeAll(ensureSharedBuild, timeout)
  await setup({ rootDir, buildDir: sharedBuildDir, build: false, server: true, setupTimeout: timeout, env })
}
