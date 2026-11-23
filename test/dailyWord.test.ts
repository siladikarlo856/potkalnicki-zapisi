import { describe, expect, it } from 'vitest'
import { DAILY_CATEGORIES, DAILY_WORD_EPOCH, addDays, dailyBrokenStreak, dailyRevealedLetters, dailySolvedStreak, dailyWordShareMessage, judgeDailyGuess, dailyWordNumber, dayDiff, deriveDailyStats, zagrebDay, zagrebMidnightUtc } from '../shared/utils/dailyWord'
import type { DailyProgress } from '../shared/utils/dailyWord'
import { pickDistractors, seededRandom } from '../shared/utils/multipleChoice'
import type { WordEntry } from '../app/types/heritage'

function result(solved = true, tries = 1, done = true): DailyProgress {
  return { wordId: 'word', guesses: ['a', 'b', 'c'].slice(0, tries), done, solved, tries, maxTries: 3 }
}

describe('Zagreb calendar', () => {
  it.each([
    ['2026-03-29', '2026-03-28T23:00:00.000Z', 23],
    ['2026-10-25', '2026-10-24T22:00:00.000Z', 25],
    ['2027-03-28', '2027-03-27T23:00:00.000Z', 23],
    ['2027-10-31', '2027-10-30T22:00:00.000Z', 25]
  ])('computes exact midnight and day length for %s', (day, midnight, hours) => {
    const start = zagrebMidnightUtc(day)
    const next = zagrebMidnightUtc(addDays(day, 1))
    expect(start.toISOString()).toBe(midnight)
    expect((next.getTime() - start.getTime()) / 3_600_000).toBe(hours)
    expect(zagrebDay(start)).toBe(day)
    expect(zagrebDay(new Date(start.getTime() - 1))).toBe(addDays(day, -1))
    expect(zagrebDay(new Date(next.getTime() - 1))).toBe(day)
    expect(zagrebDay(next)).toBe(addDays(day, 1))
    expect(dayDiff(day, addDays(day, 1))).toBe(1)
  })

  it('uses Zagreb midnight at year boundaries and UTC calendar arithmetic', () => {
    expect(zagrebDay(new Date('2026-12-31T23:00:00Z'))).toBe('2027-01-01')
    expect(zagrebMidnightUtc('2027-01-01').toISOString()).toBe('2026-12-31T23:00:00.000Z')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(dayDiff('2027-01-01', '2026-12-31')).toBe(-1)
    expect(dayDiff('2026-03-28', '2026-03-30')).toBe(2)
    expect(dailyWordNumber(DAILY_WORD_EPOCH)).toBe(1)
    expect(dailyWordNumber(addDays(DAILY_WORD_EPOCH, 11))).toBe(12)
    expect(dailyWordNumber(addDays(DAILY_WORD_EPOCH, -1))).toBe(0)
    expect(dailyWordNumber(addDays(DAILY_WORD_EPOCH, -12))).toBe(-11)
  })

  it('rejects malformed or impossible day keys and fractional increments', () => {
    for (const day of ['2026-2-01', '2026-02-30', 'invalid', '2026-13-01']) {
      expect(() => addDays(day, 1)).toThrow(RangeError)
      expect(() => zagrebMidnightUtc(day)).toThrow(RangeError)
    }
    expect(() => addDays('2026-01-01', 0.5)).toThrow(RangeError)
  })
})

describe('device stats', () => {
  it('returns zeros for no finished days', () => {
    expect(deriveDailyStats({ '2026-11-01': result(false, 1, false) }, '2026-11-01')).toEqual({
      streak: 0, maxStreak: 0, played: 0, percentCorrect: 0, distribution: { 1: 0, 2: 0, 3: 0, X: 0 }
    })
  })

  it.each([
    ['2026-11-01', '2026-10-31', '2026-10-30'],
    ['2027-01-01', '2026-12-31', '2026-12-30'],
    ['2026-03-30', '2026-03-29', '2026-03-28'],
    ['2026-10-26', '2026-10-25', '2026-10-24']
  ])('keeps yesterday streak across rollovers at %s, including an unfinished today', (today, yesterday, before) => {
    const days = { [yesterday]: result(false, 3), [before]: result(), [today]: result(false, 1, false) }
    expect(deriveDailyStats(days, today)).toMatchObject({ streak: 2, maxStreak: 2, played: 2, percentCorrect: 50 })
    expect(deriveDailyStats({ ...days, [today]: result(true, 2) }, today).streak).toBe(3)
  })

  it('breaks on gaps and counts wins, losses and tries only for completed days', () => {
    const days = {
      '2026-10-27': result(), '2026-10-28': result(true, 2), '2026-10-29': result(true, 3),
      '2026-10-31': result(false, 3), '2026-11-01': result(false, 1, false), '2026-11-02': result()
    }
    const before = structuredClone(days)
    expect(deriveDailyStats(days, '2026-11-01')).toEqual({ streak: 1, maxStreak: 3, played: 4, percentCorrect: 75, distribution: { 1: 1, 2: 1, 3: 1, X: 1 } })
    expect(deriveDailyStats(days, '2026-11-03').streak).toBe(1)
    expect(deriveDailyStats(days, '2026-11-04').streak).toBe(0)
    expect(days).toEqual(before)
    expect(deriveDailyStats({ '2026-10-29': result() }, '2026-11-01').streak).toBe(0)
  })

  it('rounds percent correct and counts a reduced-options loss as X', () => {
    expect(deriveDailyStats({
      '2026-10-30': result(), '2026-10-31': { ...result(false, 2), maxTries: 2 }, '2026-11-01': result(false, 3)
    }, '2026-11-01')).toMatchObject({ streak: 3, percentCorrect: 33, distribution: { 1: 1, 2: 0, 3: 0, X: 2 } })
  })
})

describe('shared distractors and categories', () => {
  const word = (id: string, hr: string, en?: string, partOfSpeech = 'imenica'): WordEntry => ({ id, headword: id, meaning: { hr, en }, partOfSpeech, variants: [], status: 'verified', sources: [] })
  it('deduplicates both languages with normalization and prefers matching types', () => {
    const entry = word('a', 'kuća', 'house', 'imenica, ž. r.')
    const pool = [entry, word('b', ' KUĆA ', 'home'), word('c', 'dom', ' HOUSE '), word('d', 'sat', 'clock'), word('e', 'šećer', 'sugar'), word('f', 'šešir', 'hat'), word('g', 'trčati', 'run', 'glagol')]
    const before = structuredClone(pool)
    for (let seed = 0; seed < 10; seed++) {
      expect(pickDistractors(entry, pool, seededRandom(seed)).map(word => word.id).sort()).toEqual(['d', 'e', 'f'])
    }
    expect(pickDistractors(entry, pool, seededRandom(1), 1)).toHaveLength(1)
    expect(pickDistractors(entry, pool, seededRandom(1), 0)).toEqual([])
    expect(pickDistractors(entry, [entry], seededRandom(1))).toEqual([])
    expect(pool).toEqual(before)
  })
  it('keeps quiz HR selection independent of English collisions', () => {
    const entry = word('a', 'kuća', 'house')
    const other = word('b', 'dom', 'house')
    expect(pickDistractors(entry, [entry, other], seededRandom(1))).toEqual([])
    expect(pickDistractors(entry, [entry, other], seededRandom(1), 3, 'hr')).toEqual([other])
  })
  it('defines all thirteen editorial slugs once', () => {
    expect(DAILY_CATEGORIES).toEqual(['house', 'yard', 'clothing', 'food', 'time', 'weather', 'people', 'body', 'animals', 'work', 'customs', 'feelings', 'function'])
    expect(new Set(DAILY_CATEGORIES).size).toBe(13)
  })
})

describe('typed daily round helpers', () => {
  it('judges guesses ignoring case and diacritics, with a one-letter near miss from five letters', () => {
    expect(judgeDailyGuess('SKRLAK', ['škrlak'])).toEqual({ kind: 'right', answer: 'škrlak', exact: true })
    expect(judgeDailyGuess('skrlek', ['škrlak'])).toEqual({ kind: 'right', answer: 'škrlak', exact: false })
    expect(judgeDailyGuess('klobuk', ['škrlak']).kind).toBe('wrong')
    expect(judgeDailyGuess('kuc', ['kuća']).kind).toBe('wrong')
    expect(judgeDailyGuess('  ', ['kuća']).kind).toBe('wrong')
    expect(judgeDailyGuess('hiža', ['kuća', 'hiža']).kind).toBe('right')
  })

  it('reveals the first letter and one more after each wrong guess', () => {
    expect(dailyRevealedLetters('škrlak', 0)).toEqual(['š', '', '', '', '', ''])
    expect(dailyRevealedLetters('škrlak', 2)).toEqual(['š', 'k', 'r', '', '', ''])
  })

  it('builds a share message without the word', () => {
    const result = { done: true, solved: true, tries: 2, maxTries: 5 }
    expect(dailyWordShareMessage('2026-11-15', result, 5)).toBe('Potkalnički zapisi · Riječ dana 15. 11.\n🟨🟩⬜⬜⬜ 2/5 · niz 5')
    expect(dailyWordShareMessage('2026-11-15', { ...result, solved: false, tries: 5 }, 0)).toContain('🟨🟨🟨🟨🟨 X/5')
    expect(dailyWordShareMessage('2026-11-15', { ...result, done: false }, 1)).toBe('')
  })

  it('counts solved days only for the streak and reports a broken run', () => {
    const day = (solved: boolean) => ({ wordId: 'w', guesses: [], done: true, solved, tries: 1, maxTries: 5 })
    const days = { '2026-11-12': day(true), '2026-11-13': day(true), '2026-11-14': day(true), '2026-11-15': day(false) }
    expect(dailySolvedStreak(days, '2026-11-15')).toBe(0)
    expect(dailyBrokenStreak(days, '2026-11-15')).toBe(3)
    expect(dailySolvedStreak(days, '2026-11-16')).toBe(0)
    expect(dailySolvedStreak({ ...days, '2026-11-15': day(true) }, '2026-11-15')).toBe(4)
  })

  it('preserves a solved streak across recorded outages without counting them as played', () => {
    const days: Record<string, DailyProgress> = { '2026-11-14': result() }
    const outages = ['2026-11-15']
    expect(dailySolvedStreak(days, '2026-11-15', outages)).toBe(1)
    expect(dailySolvedStreak(days, '2026-11-16', outages)).toBe(1)
    days['2026-11-16'] = result()
    expect(dailySolvedStreak(days, '2026-11-16', outages)).toBe(2)
    expect(deriveDailyStats(days, '2026-11-16', outages)).toMatchObject({ streak: 2, maxStreak: 2, played: 2, percentCorrect: 100 })
    expect(dailyWordShareMessage('2026-11-16', days['2026-11-16']!, dailySolvedStreak(days, '2026-11-16', outages))).toContain('niz 2')
    expect(dailySolvedStreak(days, '2026-11-18', [...outages, '2026-11-17'])).toBe(2)
    expect(dailySolvedStreak(days, '2026-11-19', [...outages, '2026-11-17', '2026-11-18'])).toBe(2)
  })

  it('breaks the streak on an ordinary missed day without an outage record', () => {
    const days = { '2026-11-14': result() }
    expect(dailySolvedStreak(days, '2026-11-16')).toBe(0)
    const resumed = { ...days, '2026-11-16': result() }
    expect(dailySolvedStreak(resumed, '2026-11-16')).toBe(1)
    expect(deriveDailyStats(resumed, '2026-11-16')).toMatchObject({ streak: 1, maxStreak: 1, played: 2 })
    expect(dailySolvedStreak(days, '2026-11-17', ['2026-11-16'])).toBe(0)
  })

  it('lets a completed loss override an outage and reports the broken run across outages', () => {
    const days = { '2026-11-14': result(), '2026-11-16': result(false, 3) }
    const outages = ['2026-11-15', '2026-11-16']
    expect(dailySolvedStreak(days, '2026-11-16', outages)).toBe(0)
    expect(dailyBrokenStreak(days, '2026-11-16', outages)).toBe(1)
    expect(dailySolvedStreak({ ...days, '2026-11-17': result() }, '2026-11-17', outages)).toBe(1)
    expect(dailyBrokenStreak({ ...days, '2026-11-16': result() }, '2026-11-16', outages)).toBe(0)
  })

  it('reports no broken run when a missed or unfinished day had already ended it', () => {
    const day = (solved: boolean, done = true) => ({ wordId: 'w', guesses: [], done, solved, tries: 1, maxTries: 5 })
    const gap = { '2026-11-13': day(true), '2026-11-14': day(true), '2026-11-16': day(false) }
    expect(dailyBrokenStreak(gap, '2026-11-16')).toBe(0)
    expect(dailyBrokenStreak({ ...gap, '2026-11-15': day(false, false) }, '2026-11-16')).toBe(0)
    expect(dailyBrokenStreak({ ...gap, '2026-11-15': day(true) }, '2026-11-16')).toBe(3)
  })
})
