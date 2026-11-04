import { describe, expect, it } from 'vitest'
import { BEZ_GRESKE_SCORE_MAX, nextBezGreskeQuestion } from '../shared/utils/games/bezGreske'
import { mulberry32 } from '../shared/utils/games/rng'
import { fixtureCardPool } from './fixtures/gamePool'

describe('bez greške questions', () => {
  it('returns a mixed question from the fixture pool', () => {
    const pool = fixtureCardPool()
    const rng = mulberry32(1)
    const question = nextBezGreskeQuestion(pool, rng, new Set())
    expect(question).not.toBeNull()
    expect(['znacenje', 'opcina', 'crkva']).toContain(question!.gameId)
    expect(BEZ_GRESKE_SCORE_MAX).toBeGreaterThan(100)
  })
})
