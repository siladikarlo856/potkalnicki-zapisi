import { describe, expect, it } from 'vitest'
import { applyChallengeCreateQuery, challengeCreateGameEnabled, challengeCreateGameOptions, defaultChallengeCreateForm } from '../shared/utils/challengeCreateForm'
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

  it('offers every challengeable game, club games included, after the mixed game', () => {
    expect(challengeCreateGameOptions('hr').map(option => option.id)).toEqual([
      'mjesovito', 'znacenje', 'rijec', 'karta-koje', 'opcina', 'crkva', 'osoba',
      'karta-tocke', 'klub-mjesto', 'klub-liga', 'klub-odakle'
    ])
  })

  it('labels each game option with its game name', () => {
    const labels = Object.fromEntries(challengeCreateGameOptions('hr').map(option => [option.id, option.label]))
    expect(labels['mjesovito']).toBe('Mješovito')
    expect(labels['klub-liga']).toBe('U kojoj ligi klub igra u sezoni?')
  })

  it('prefills a club game from the query', () => {
    expect(applyChallengeCreateQuery({ igra: 'klub-odakle' }, live).game).toBe('klub-odakle')
  })
})
