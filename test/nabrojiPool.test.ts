import { describe, expect, it } from 'vitest'
import { fixtureCardPool } from './fixtures/gamePool'
import { matchSettlement } from '../shared/utils/games/matchSettlement'

describe('fixture pool nabroji', () => {
  it('matches sopron for kalnik', () => {
    const pool = fixtureCardPool()
    const kalnik = pool.municipalities.find(m => m.slug === 'opcina-kalnik')!
    const names = pool.settlements.filter(s => s.municipalityId === kalnik.id).map(s => s.name)
    expect(names).toHaveLength(8)
    expect(matchSettlement('sopron', names)).toBe('Šopron')
  })
})
