import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState } from '#imports'
import { defineComponent, h } from 'vue'
import { createError } from 'h3'
import { DAILY_STORAGE_KEY, useDailyProgress } from '../app/composables/useDailyProgress'
import { useDailyWord } from '../app/composables/useDailyWord'
import type { DailyProgress, DailyWordPayload } from '../shared/utils/dailyWord'

let failure: number | undefined
let statusMessage: string | undefined
registerEndpoint('/api/heritage/daily', () => {
  if (failure) throw createError({ statusCode: failure, statusMessage })
  return {
    day: '2026-11-17', number: 16, nextAt: '2026-11-18T23:00:00Z', sample: false,
    entry: { id: 'word', headword: 'riječ', meaning: { hr: 'značenje' }, variants: [], status: 'verified', sources: [] },
    areas: [], villageAreaId: null, options: [], correctOptionId: '', clues: []
  } satisfies DailyWordPayload
})

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
let progress: ReturnType<typeof useDailyProgress>
let daily: ReturnType<typeof useDailyWord>
const stateKeys = ['heritage-daily-progress', 'heritage-daily-progress-loaded', 'heritage-daily-progress-unavailable']
const win: DailyProgress = { wordId: 'word', guesses: ['riječ'], done: true, solved: true, tries: 1, maxTries: 5 }
const stored = () => JSON.parse(localStorage.getItem(DAILY_STORAGE_KEY)!)

async function mountDaily() {
  wrapper = await mountSuspended(defineComponent({
    setup() {
      daily = useDailyWord()
      progress = useDailyProgress()
      return () => h('span', daily.error.value ? 'error' : daily.payload.value?.day)
    }
  }))
  await expect.poll(() => daily.status.value, { timeout: 5000 }).toBe(failure ? 'error' : 'success')
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-15T23:30:00Z'))
  failure = 503
  statusMessage = 'unavailable'
  localStorage.clear()
  clearNuxtState(stateKeys)
  clearNuxtData('heritage-daily-word')
  localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-11-15': win } }))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  clearNuxtData('heritage-daily-word')
})

describe('device-local daily outages', () => {
  it.each([503, 404])('records outage %s once and continues the streak after reloading and solving tomorrow', async (code) => {
    failure = code
    statusMessage = code === 404 ? 'no-words' : 'unavailable'
    await mountDaily()
    expect(daily.unavailable.value).toBe(false)
    expect(stored()).toEqual({ version: 1, days: { '2026-11-15': win }, outageDays: ['2026-11-16'] })
    await daily.refresh()
    expect(stored().outageDays).toEqual(['2026-11-16'])
    wrapper!.unmount()
    clearNuxtState(stateKeys)
    clearNuxtData('heritage-daily-word')
    failure = undefined
    vi.setSystemTime(new Date('2026-11-17T12:00:00Z'))
    await mountDaily()
    expect(progress.solvedStreakFor('2026-11-17')).toBe(1)
    progress.save('2026-11-17', win)
    expect(progress.solvedStreakFor('2026-11-17')).toBe(2)
    expect(progress.statsFor('2026-11-17')).toMatchObject({ streak: 2, maxStreak: 2, played: 2 })
    expect(stored().outageDays).toEqual(['2026-11-16'])
    expect(stored().days['2026-11-17']).toEqual(win)
  })

  it('does not exempt a completed loss after an outage', async () => {
    await mountDaily()
    progress.save('2026-11-16', { ...win, solved: false, tries: 5 })
    expect(progress.solvedStreakFor('2026-11-16')).toBe(0)
    expect(progress.brokenStreakFor('2026-11-16')).toBe(1)
    progress.save('2026-11-17', win)
    expect(progress.solvedStreakFor('2026-11-17')).toBe(1)
  })

  it('does not record the pre-launch not-started response as an outage', async () => {
    failure = 404
    statusMessage = 'not-started'
    await mountDaily()
    expect(daily.unavailable.value).toBe(true)
    expect(stored()).toEqual({ version: 1, days: { '2026-11-15': win } })
  })
})
