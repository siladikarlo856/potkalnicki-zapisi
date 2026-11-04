import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { clearNuxtState } from '#imports'
import { defineComponent, h } from 'vue'
import { LEGACY_PROGRESS_STORAGE_KEY, PROGRESS_STORAGE_KEY, useProgress } from '../app/composables/useProgress'

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
let progress: ReturnType<typeof useProgress>
const at = (year: number, month: number, day: number, hour = 12, minute = 0) => {
  vi.setSystemTime(new Date(year, month - 1, day, hour, minute))
}
async function mountProgress() {
  wrapper = await mountSuspended(defineComponent({
    setup() {
      progress = useProgress()
      return () => h('span', progress.totals.value.known)
    }
  }))
  return progress
}
function stored() {
  return JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY)!)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  at(2026, 10, 31)
  localStorage.clear()
  clearNuxtState(['heritage-progress', 'heritage-progress-loaded'])
})
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('browser-local heritage progress', () => {
  it('records independent word counts, last played and totals and reloads them', async () => {
    const p = await mountProgress()
    p.recordSeen('word-a')
    p.recordSeen('word-a')
    p.recordKnown('word-a')
    p.recordMissed('word-b')
    expect(p.words.value['word-a']).toEqual({ seen: 2, known: 1, missed: 0, lastPlayed: '2026-10-31' })
    expect(p.words.value['word-b']).toEqual({ seen: 0, known: 0, missed: 1, lastPlayed: '2026-10-31' })
    expect(p.totals.value).toEqual({ seen: 2, known: 1, missed: 1 })
    expect(p.lastPlayed.value).toBe('2026-10-31')
    expect(stored().version).toBe(2)
    wrapper?.unmount()
    clearNuxtState(['heritage-progress', 'heritage-progress-loaded'])
    const reloaded = await mountProgress()
    expect(reloaded.totals.value).toEqual({ seen: 2, known: 1, missed: 1 })
    expect(reloaded.lastPlayed.value).toBe('2026-10-31')
  })

  it('counts one action per local calendar day across month and year boundaries', async () => {
    at(2026, 12, 31, 23, 59)
    const p = await mountProgress()
    p.recordSeen('a')
    p.recordKnown('a')
    p.recordMissed('b')
    expect(p.streak.value).toBe(1)
    at(2027, 1, 1, 0, 1)
    p.recordKnown('b')
    expect(p.lastPlayed.value).toBe('2027-01-01')
    expect(p.streak.value).toBe(2)
    at(2027, 1, 2)
    vi.advanceTimersByTime(60_000)
    expect(p.streak.value).toBe(2) // There is still all of today to play.
    at(2027, 1, 3)
    vi.advanceTimersByTime(60_000)
    expect(p.streak.value).toBe(0)
    p.recordSeen('a')
    expect(p.streak.value).toBe(1)
  })

  it('uses calendar days rather than elapsed hours at a daylight-saving boundary', async () => {
    at(2026, 3, 28, 23, 59)
    const p = await mountProgress()
    p.recordSeen('a')
    at(2026, 3, 29, 0, 1)
    p.recordSeen('a')
    expect(p.streak.value).toBe(2)
  })

  it('ignores other storage versions and leaves them intact', async () => {
    localStorage.setItem('pz-progress/v0', '{"old":true}')
    const p = await mountProgress()
    expect(p.totals.value).toEqual({ seen: 0, known: 0, missed: 0 })
    expect(p.lastPlayed.value).toBeNull()
    expect(p.streak.value).toBe(0)
    p.recordSeen('a')
    expect(stored().version).toBe(2)
    expect(localStorage.getItem('pz-progress/v0')).toBe('{"old":true}')
  })

  it.each([
    '{broken', 'null', '[]',
    JSON.stringify({ version: 3, cards: {}, lastPlayed: null, streak: 0 }),
    JSON.stringify({ version: 2, cards: {}, lastPlayed: '2026-02-30', streak: 1 }),
    JSON.stringify({ version: 2, cards: { 'word:a': { box: 1, due: '2026-10-31', seen: -1, known: 0, missed: 0, lastPlayed: '2026-10-31' } }, lastPlayed: '2026-10-31', streak: 1 }),
    JSON.stringify({ version: 2, cards: { 'word:a': null }, lastPlayed: null, streak: 0 })
  ])('resets corrupt or unsupported data safely: %s', async (raw) => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, raw)
    const p = await mountProgress()
    expect(p.lastPlayed.value).toBeNull()
    expect(p.totals.value).toEqual({ seen: 0, known: 0, missed: 0 })
    p.recordMissed('a')
    expect(stored().cards['word:a'].missed).toBe(1)
  })

  it('migrates legacy v1 progress into v2 and keeps the v1 blob', async () => {
    localStorage.setItem(LEGACY_PROGRESS_STORAGE_KEY, JSON.stringify({
      version: 1,
      words: {
        w: { seen: 2, known: 3, missed: 1, lastPlayed: '2026-10-31' }
      },
      lastPlayed: '2026-10-31',
      streak: 2
    }))
    const p = await mountProgress()
    expect(localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY)).toContain('"version":1')
    expect(stored().version).toBe(2)
    expect(stored().cards['word:w']).toMatchObject({ seen: 2, known: 3, missed: 1, box: 2 })
    expect(p.words.value.w).toEqual({ seen: 2, known: 3, missed: 1, lastPlayed: '2026-10-31' })
  })

  it('migrates ambiguous v1 words to box 1', async () => {
    localStorage.setItem(LEGACY_PROGRESS_STORAGE_KEY, JSON.stringify({
      version: 1,
      words: { tie: { seen: 1, known: 1, missed: 1, lastPlayed: '2026-10-31' } },
      lastPlayed: '2026-10-31',
      streak: 1
    }))
    await mountProgress()
    expect(stored().cards['word:tie'].box).toBe(1)
  })

  it('starts empty when legacy v1 data is malformed but leaves the blob', async () => {
    localStorage.setItem(LEGACY_PROGRESS_STORAGE_KEY, '{broken')
    const p = await mountProgress()
    expect(p.totals.value).toEqual({ seen: 0, known: 0, missed: 0 })
    expect(localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY)).toBe('{broken')
  })

  it('keeps in-memory progress when reading or writing storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    const p = await mountProgress()
    expect(() => p.recordSeen('a')).not.toThrow()
    p.recordKnown('a')
    expect(p.totals.value).toEqual({ seen: 1, known: 1, missed: 0 })
    expect(p.streak.value).toBe(1)
  })

  it('also guards access to the localStorage property itself', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('private mode')
    })
    const p = await mountProgress()
    expect(() => p.recordMissed('a')).not.toThrow()
    expect(p.totals.value.missed).toBe(1)
  })

  it('shares state between consumers without rereading stale storage', async () => {
    const p = await mountProgress()
    p.recordKnown('a')
    const first = wrapper
    const second = await mountProgress()
    expect(second.totals.value.known).toBe(1)
    second.recordMissed('b')
    expect(p.totals.value.missed).toBe(1)
    first?.unmount()
  })

  it('handles arbitrary word ids without inheriting object properties', async () => {
    const p = await mountProgress()
    p.recordSeen('__proto__')
    p.recordKnown('constructor')
    expect(p.words.value['__proto__']?.seen).toBe(1)
    expect(p.totals.value).toEqual({ seen: 1, known: 1, missed: 0 })
  })
})
