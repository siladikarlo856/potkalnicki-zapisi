import { describe, expect, it } from 'vitest'
import { decodeGameScores, emptyGameScores, withBestScore } from '../shared/utils/games/scores'

describe('pz-games/v1 best scores', () => {
  it('decodes valid state and returns the empty state for anything malformed', () => {
    const valid = { version: 1, best: { znacenje: { score: 7, max: 10, at: '2026-11-04T10:00:00.000Z' } } }
    expect(decodeGameScores(JSON.stringify(valid))).toEqual(valid)
    for (const raw of [null, '', '{', '[]', '{"version":2,"best":{}}', '{"version":1}', '{"version":1,"best":[]}',
      '{"version":1,"best":{"x":{"score":11,"max":10,"at":"a"}}}', '{"version":1,"best":{"x":{"score":1,"max":0,"at":"a"}}}',
      '{"version":1,"best":{"x":{"score":-1,"max":5,"at":"a"}}}', '{"version":1,"best":{"x":{"score":1,"max":5}}}']) {
      expect(decodeGameScores(raw)).toEqual(emptyGameScores())
    }
  })

  it('keeps the better share of correct answers and ignores ties and worse rounds', () => {
    let state = withBestScore(emptyGameScores(), 'rijec', 6, 10, 'day1')
    expect(state.best.rijec).toEqual({ score: 6, max: 10, at: 'day1' })
    expect(withBestScore(state, 'rijec', 5, 10, 'day2')).toBe(state)
    expect(withBestScore(state, 'rijec', 3, 5, 'day2')).toBe(state)
    state = withBestScore(state, 'rijec', 4, 5, 'day3')
    expect(state.best.rijec).toEqual({ score: 4, max: 5, at: 'day3' })
    expect(withBestScore(state, 'rijec', 0, 10, 'day4')).toBe(state)
    expect(withBestScore(state, 'znacenje', 1, 10, 'day4').best.znacenje).toEqual({ score: 1, max: 10, at: 'day4' })
    expect(withBestScore(state, 'opcina', 0, 0, 'day4')).toBe(state)
  })

  it('saves a first zero, reloads it, keeps zero ties and accepts a later improvement', () => {
    const state = withBestScore(emptyGameScores(), 'znacenje', 0, 10, 'day1')
    expect(state.best.znacenje).toEqual({ score: 0, max: 10, at: 'day1' })
    expect(decodeGameScores(JSON.stringify(state))).toEqual(state)
    expect(withBestScore(state, 'znacenje', 0, 5, 'day2')).toBe(state)
    expect(withBestScore(state, 'znacenje', 1, 10, 'day3').best.znacenje).toEqual({ score: 1, max: 10, at: 'day3' })
  })
})
