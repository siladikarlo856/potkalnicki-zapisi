import { describe, expect, it } from 'vitest'
import { shouldTrackPath } from '../app/utils/analytics'

describe('shouldTrackPath', () => {
  it('tracks portfolio and app pages', () => {
    for (const path of ['/', '/en', '/potkalnicko-prigorje', '/potkalnicko-prigorje/igre/kviz', '/administracija']) {
      expect(shouldTrackPath(path)).toBe(true)
    }
  })

  it('skips admin pages', () => {
    for (const path of ['/admin', '/admin/prijava', '/admin/rijeci', '/en/admin/prijava']) {
      expect(shouldTrackPath(path)).toBe(false)
    }
  })
})
