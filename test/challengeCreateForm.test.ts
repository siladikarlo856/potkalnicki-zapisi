import { describe, expect, it } from 'vitest'
import { applyChallengeCreateQuery, challengeCreateGameEnabled, defaultChallengeCreateForm } from '../shared/utils/challengeCreateForm'
import { fixtureCardPool } from './fixtures/gamePool'

describe('challenge create form helpers', () => {
  const pool = fixtureCardPool()
  const live = new Set(pool.topics.filter(t => t.status === 'live').map(t => t.id))

  it('prefills topics, game, difficulty and length from query params', () => {
    const form = applyChallengeCreateQuery({
      teme: 'rijeci',
      igra: 'znacenje',
      tezina: 'lako',
      n: '5'
    }, live)
    expect(form).toMatchObject({
      topics: ['rijeci'],
      game: 'znacenje',
      difficulty: 'lako',
      length: 5
    })
  })

  it('disables incompatible games for the selected topics', () => {
    expect(challengeCreateGameEnabled('opcina', ['mjesta'], pool)).toBe(true)
    expect(challengeCreateGameEnabled('znacenje', ['mjesta'], pool)).toBe(false)
  })

  it('starts from the default generate preset', () => {
    expect(defaultChallengeCreateForm().length).toBe(10)
  })
})
