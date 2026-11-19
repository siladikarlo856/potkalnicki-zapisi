import { computed, onBeforeUnmount, onMounted, readonly } from 'vue'
import { useState } from '#imports'
import { dailyBrokenStreak, dailySolvedStreak, deriveDailyStats } from '~~/shared/utils/dailyWord'
import type { DailyProgress } from '~~/shared/utils/dailyWord'

export const DAILY_STORAGE_KEY = 'ksh.heritage.daily.v1'

interface DailyStoreV1 {
  version: 1
  days: Record<string, DailyProgress>
}

const emptyStore = (): DailyStoreV1 => ({ version: 1, days: {} })
const dayKey = /^\d{4}-\d{2}-\d{2}$/
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0

function validRecord(value: unknown): value is DailyProgress {
  const record = value as DailyProgress
  return !!record && typeof record === 'object' && typeof record.wordId === 'string' && record.wordId.length > 0
    && Array.isArray(record.guesses) && record.guesses.every(id => typeof id === 'string')
    && typeof record.done === 'boolean' && typeof record.solved === 'boolean'
    && count(record.tries) && count(record.maxTries) && record.maxTries >= 1 && record.tries <= record.maxTries
    && (!record.solved || record.done) && (record.finishedAt === undefined || typeof record.finishedAt === 'string')
}

/** Unknown versions or shapes are ignored rather than trusted; one bad day never hides the rest. */
function decode(raw: string | null): DailyStoreV1 {
  if (!raw) return emptyStore()
  const data = JSON.parse(raw)
  if (!data || data.version !== 1 || !data.days || typeof data.days !== 'object' || Array.isArray(data.days)) return emptyStore()
  const days: Record<string, DailyProgress> = {}
  for (const [day, record] of Object.entries(data.days)) {
    if (dayKey.test(day) && validRecord(record)) days[day] = record
  }
  return { version: 1, days }
}

/**
 * Browser-local daily word results. Days are keyed by the server-provided Zagreb day, never
 * the device date. Storage failures never interrupt play: the game continues in memory.
 */
export function useDailyProgress() {
  const store = useState<DailyStoreV1>('heritage-daily-progress', emptyStore)
  const loaded = useState('heritage-daily-progress-loaded', () => false)
  const unavailable = useState('heritage-daily-progress-unavailable', () => false)

  function load() {
    if (!import.meta.client) return
    try {
      store.value = decode(window.localStorage.getItem(DAILY_STORAGE_KEY))
      unavailable.value = false
    } catch {
      store.value = emptyStore()
      unavailable.value = true
    }
    loaded.value = true
  }

  // Finishing in another tab updates this one.
  function onStorage(event: StorageEvent) {
    if (event.key === null || event.key === DAILY_STORAGE_KEY) load()
  }
  onMounted(() => {
    if (!loaded.value) load()
    window.addEventListener('storage', onStorage)
  })
  onBeforeUnmount(() => {
    if (import.meta.client) window.removeEventListener('storage', onStorage)
  })

  /** Saved after every guess, so a reload resumes the same round and cannot retry it. */
  function save(day: string, progress: DailyProgress) {
    if (!import.meta.client) return
    store.value = { version: 1, days: { ...store.value.days, [day]: progress } }
    try {
      window.localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(store.value))
      unavailable.value = false
    } catch {
      unavailable.value = true
    }
  }

  return {
    days: computed(() => readonly(store.value.days)),
    loaded: computed(() => loaded.value),
    storageUnavailable: computed(() => unavailable.value),
    save,
    statsFor: (today: string) => deriveDailyStats(store.value.days, today),
    solvedStreakFor: (today: string) => dailySolvedStreak(store.value.days, today),
    brokenStreakFor: (today: string) => dailyBrokenStreak(store.value.days, today)
  }
}
