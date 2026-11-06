import { cleanSharedBuild } from './sharedBuild'

// A fresh shared build per run, so a stale one never hides code changes.
// CI sets NUXT_TEST_REUSE_BUILD=1 so its two Vitest steps share one build of the same checkout.
const reuse = process.env.NUXT_TEST_REUSE_BUILD === '1'

// Both server projects (node and node-serial) list this setup; only the first one to run owns the build,
// so the later one never deletes it while the other project is still using it.
export default function () {
  if (process.env.KSH_SHARED_BUILD_OWNED) return
  process.env.KSH_SHARED_BUILD_OWNED = '1'
  if (!reuse) cleanSharedBuild()
  return () => {
    delete process.env.KSH_SHARED_BUILD_OWNED
    if (!reuse) cleanSharedBuild()
  }
}
