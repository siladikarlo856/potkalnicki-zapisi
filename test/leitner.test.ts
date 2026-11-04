import { describe, expect, it } from 'vitest'
import { INTERVAL_DAYS, addDays, applyAnswer, isDue, isLearned } from '../shared/utils/learn/leitner'

describe('leitner helpers', () => {
  it('addDays rolls over month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('schedules due dates from INTERVAL_DAYS for each box', () => {
    const today = '2026-11-04'
    expect(applyAnswer(undefined, false, today).due).toBe(addDays(today, INTERVAL_DAYS[1]))
    expect(applyAnswer(undefined, true, today).due).toBe(addDays(today, INTERVAL_DAYS[2]))
    const box3 = applyAnswer({ box: 2, due: today, seen: 1, known: 1, missed: 0, lastPlayed: today }, true, today)
    expect(box3.box).toBe(3)
    expect(box3.due).toBe(addDays(today, INTERVAL_DAYS[3]))
  })

  it.each([
    { label: 'miss moves to box 1', knew: false, start: { box: 4 as const, due: '2026-11-01', seen: 2, known: 2, missed: 0, lastPlayed: '2026-11-01' }, box: 1 },
    { label: 'know bumps box', knew: true, start: { box: 1 as const, due: '2026-11-01', seen: 1, known: 0, missed: 1, lastPlayed: '2026-11-01' }, box: 2 },
    { label: 'know from box 4', knew: true, start: { box: 4 as const, due: '2026-11-01', seen: 4, known: 4, missed: 0, lastPlayed: '2026-11-01' }, box: 5 },
    { label: 'know stays at box 5', knew: true, start: { box: 5 as const, due: '2026-12-01', seen: 5, known: 5, missed: 0, lastPlayed: '2026-11-01' }, box: 5 }
  ])('$label', ({ knew, start, box }) => {
    const today = '2026-11-04'
    expect(applyAnswer(start, knew, today).box).toBe(box)
  })

  it('marks due and learned cards', () => {
    const today = '2026-11-04'
    const fresh = applyAnswer(undefined, true, today)
    expect(isDue(fresh, today)).toBe(false)
    expect(isDue(applyAnswer(undefined, false, today), today)).toBe(true)
    expect(isLearned(fresh)).toBe(false)
    const mastered = applyAnswer({ box: 4, due: today, seen: 4, known: 4, missed: 0, lastPlayed: today }, true, today)
    expect(isLearned(mastered)).toBe(true)
    expect(isDue({ box: 2, due: '2026-11-10', seen: 1, known: 1, missed: 0, lastPlayed: today }, today)).toBe(false)
  })
})
