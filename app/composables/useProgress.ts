import { computed, onBeforeUnmount, onMounted, readonly, ref } from 'vue'
import { useState } from '#imports'

export const PROGRESS_STORAGE_KEY = 'pz-progress/v1'

export interface WordProgress {
  seen: number
  known: number
  missed: number
  lastPlayed: string
}

interface Progress {
  version: 1
  words: Record<string, WordProgress>
  lastPlayed: string | null
  streak: number
}

const emptyProgress = (): Progress => ({ version: 1, words: {}, lastPlayed: null, streak: 0 })
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000
const validDay = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(dayNumber(value))
  && new Date(dayNumber(value) * 86_400_000).toISOString().slice(0, 10) === value

// Calendar dates use the browser's local timezone; UTC is only used to compare date labels.
function localDay() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function decode(raw: string | null): Progress {
  if (!raw) return emptyProgress()
  const data = JSON.parse(raw)
  if (!data || data.version !== 1 || !data.words || typeof data.words !== 'object' || Array.isArray(data.words)
    || !count(data.streak) || !(data.lastPlayed === null || validDay(data.lastPlayed))
    || (data.lastPlayed === null ? data.streak !== 0 : data.streak < 1)) return emptyProgress()
  for (const word of Object.values(data.words) as WordProgress[]) {
    if (!word || !count(word.seen) || !count(word.known) || !count(word.missed) || !validDay(word.lastPlayed)) return emptyProgress()
  }
  return data
}

/** Guest progress is browser-local and best effort: storage failures never interrupt play. */
export function useProgress() {
  // Nuxt scopes these refs to the app/request, rather than sharing server module state.
  const progress = useState<Progress>('heritage-progress', emptyProgress)
  const loaded = useState('heritage-progress-loaded', () => false)
  const today = ref(localDay())

  function load() {
    if (!import.meta.client || loaded.value) return
    loaded.value = true
    try {
      progress.value = decode(window.localStorage.getItem(PROGRESS_STORAGE_KEY))
    } catch {
      progress.value = emptyProgress()
    }
  }

  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    load()
    today.value = localDay()
    // Also expire a stale streak when a browser tab stays open across midnight.
    timer = setInterval(() => {
      today.value = localDay()
    }, 60_000)
  })
  onBeforeUnmount(() => clearInterval(timer))

  function record(wordId: string, action: 'seen' | 'known' | 'missed') {
    if (!import.meta.client || !wordId) return
    load()
    today.value = localDay()
    const previous = progress.value
    const gap = previous.lastPlayed ? dayNumber(today.value) - dayNumber(previous.lastPlayed) : Infinity
    const oldWord = Object.hasOwn(previous.words, wordId) ? previous.words[wordId]! : { seen: 0, known: 0, missed: 0 }
    progress.value = {
      version: 1,
      words: { ...previous.words, [wordId]: { ...oldWord, [action]: oldWord[action] + 1, lastPlayed: today.value } },
      lastPlayed: today.value,
      streak: gap === 0 ? previous.streak : gap === 1 ? previous.streak + 1 : 1
    }
    try {
      window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress.value))
    } catch {
      // Keep this session's progress even when storage is unavailable or full.
    }
  }

  const totals = computed(() => Object.values(progress.value.words).reduce((sum, word) => ({
    seen: sum.seen + word.seen, known: sum.known + word.known, missed: sum.missed + word.missed
  }), { seen: 0, known: 0, missed: 0 }))
  const streak = computed(() => {
    const gap = progress.value.lastPlayed ? dayNumber(today.value) - dayNumber(progress.value.lastPlayed) : Infinity
    return gap === 0 || gap === 1 ? progress.value.streak : 0
  })

  return {
    words: computed(() => readonly(progress.value.words)),
    totals,
    lastPlayed: computed(() => progress.value.lastPlayed),
    streak,
    recordSeen: (wordId: string) => record(wordId, 'seen'),
    recordKnown: (wordId: string) => record(wordId, 'known'),
    recordMissed: (wordId: string) => record(wordId, 'missed')
  }
}
