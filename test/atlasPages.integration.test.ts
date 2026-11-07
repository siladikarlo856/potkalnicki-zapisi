import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { createSnapshotStore, loadPublicContent } from '../server/utils/publicContent'
import { integrationDb } from './support/integrationDb'

const db = await integrationDb()

describe.skipIf(!db.enabled)('atlas snapshot performance on Postgres', () => {
  it('serves a warm snapshot with p95 under 150 ms', async () => {
    const store = createSnapshotStore({ load: () => loadPublicContent(db.service) })
    await store.get()
    const samples: number[] = []
    for (let i = 0; i < 20; i++) {
      const start = performance.now()
      await store.get()
      samples.push(performance.now() - start)
    }
    samples.sort((a, b) => a - b)
    const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))]
    expect(p95).toBeLessThan(150)
  })
})
