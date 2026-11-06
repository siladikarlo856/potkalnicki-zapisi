import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const rootDir = fileURLToPath(new URL('../..', import.meta.url))
export const sharedBuildDir = resolve(rootDir, '.nuxt/test/shared')
export const lockDir = `${sharedBuildDir}.lock`
export const doneFile = resolve(sharedBuildDir, '.built')

/** Remove the shared build and any stale lock. */
export function cleanSharedBuild() {
  rmSync(sharedBuildDir, { recursive: true, force: true })
  rmSync(lockDir, { recursive: true, force: true })
}
