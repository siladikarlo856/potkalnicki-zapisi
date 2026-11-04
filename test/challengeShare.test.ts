import { describe, expect, it } from 'vitest'
import { challengeInviteShareText } from '../app/utils/shareResult'

describe('challengeInviteShareText', () => {
  it('formats the Croatian invite with topics, difficulty and closing date', () => {
    const text = challengeInviteShareText({
      nickname: 'Karlo',
      url: 'https://example.test/izazov/abc',
      questionCount: 10,
      closesAt: '2026-11-10T12:00:00Z',
      meta: { source: 'random', topics: ['rijeci'], difficulty: 'srednje', game: 'znacenje' },
      pool: { topics: [{ id: 'rijeci', label: 'Riječi', status: 'live', count: 10 }] },
      lang: 'hr'
    })
    expect(text).toContain('Karlo te izaziva: 10 pitanja · Srednje · Riječi · otvoreno do')
    expect(text).toContain('https://example.test/izazov/abc')
  })

  it('appends the target score line when the creator finished first', () => {
    const text = challengeInviteShareText({
      nickname: 'Ana',
      url: 'https://example.test/x',
      questionCount: 5,
      closesAt: '2026-11-10T12:00:00Z',
      meta: { source: 'random', difficulty: 'lako' },
      lang: 'hr',
      targetScore: 400
    })
    expect(text).toContain('Rezultat za dostići: 400 bodova')
  })
})
