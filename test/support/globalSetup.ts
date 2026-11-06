import { cleanSharedBuild } from './sharedBuild'

// A fresh shared build per run, so a stale one never hides code changes.
// CI sets NUXT_TEST_REUSE_BUILD=1 so its two Vitest steps share one build of the same checkout.
const reuse = process.env.NUXT_TEST_REUSE_BUILD === '1'

export default function () {
  if (!reuse) cleanSharedBuild()
  return () => {
    if (!reuse) cleanSharedBuild()
  }
}
