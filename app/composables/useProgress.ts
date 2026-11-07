import { computed, onBeforeUnmount, onMounted, readonly, ref } from 'vue'
import { useState } from '#imports'
import type { CardKey } from '~~/shared/utils/learn/types'
import { decodeCardKey, encodeCardKey } from '~~/shared/utils/games/cardKey'
import {
  INTERVAL_DAYS,
  addDays,
  applyAnswer,
  isDue,
  isLearned,
  type CardProgress
} from '~~/shared/utils/learn/leitner'

export const PROGRESS_STORAGE_KEY = 'pz-progress/v2'
export const LEGACY_PROGRESS_STORAGE_KEY = 'pz-progress/v1'

export interface WordProgress {
  seen: number
  known: number
  missed: number
  lastPlayed: string
}

interface ProgressV1 {
  version: 1
  words: Record<string, WordProgress>
  lastPlayed: string | null
  streak: number
}

interface ProgressV2 {
  version: 2
  cards: Record<string, CardProgress>
  lastPlayed: string | null
  streak: number
}

type Progress = ProgressV2

const emptyProgress = (): Progress => ({ version: 2, cards: {}, lastPlayed: null, streak: 0 })
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000
const validDay = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(dayNumber(value))
  && new Date(dayNumber(value) * 86_400_000).toISOString().slice(0, 10) === value

const validBox = (value: unknown): value is CardProgress['box'] =>
  value === 0 || value === 1 || value === 2 || value === 3 || value === 4 || value === 5

function validCardProgress(value: unknown): value is CardProgress {
  if (!value || typeof value !== 'object') return false
  const card = value as CardProgress
  return validBox(card.box) && validDay(card.due) && count(card.seen) && count(card.known) && count(card.missed)
    && validDay(card.lastPlayed)
}

function decodeV1(raw: string | null): ProgressV1 | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (!data || data.version !== 1 || !data.words || typeof data.words !== 'object' || Array.isArray(data.words)
      || !count(data.streak) || !(data.lastPlayed === null || validDay(data.lastPlayed))
      || (data.lastPlayed === null ? data.streak !== 0 : data.streak < 1)) return null
    for (const key of Object.keys(data.words)) {
      if (!Object.hasOwn(data.words, key)) continue
      const word = data.words[key] as WordProgress
      if (!word || !count(word.seen) || !count(word.known) || !count(word.missed) || !validDay(word.lastPlayed)) return null
    }
    return data
  } catch {
    return null
  }
}

function decodeV2(raw: string | null): Progress {
  if (!raw) return emptyProgress()
  try {
    const data = JSON.parse(raw)
    if (!data || data.version !== 2 || !data.cards || typeof data.cards !== 'object' || Array.isArray(data.cards)
      || !count(data.streak) || !(data.lastPlayed === null || validDay(data.lastPlayed))
      || (data.lastPlayed === null ? data.streak !== 0 : data.streak < 1)) return emptyProgress()
    const cards: Record<string, CardProgress> = {}
    for (const key of Object.keys(data.cards)) {
      if (!Object.hasOwn(data.cards, key)) continue
      const card = data.cards[key]
      if (!validCardProgress(card)) return emptyProgress()
      cards[key] = card
    }
    return { version: 2, cards, lastPlayed: data.lastPlayed, streak: data.streak }
  } catch {
    return emptyProgress()
  }
}

function migrateV1(v1: ProgressV1): ProgressV2 {
  const cards: Record<string, CardProgress> = {}
  for (const [wordId, word] of Object.entries(v1.words)) {
    if (!Object.hasOwn(v1.words, wordId)) continue
    const box = (word.known > word.missed ? 2 : 1) as 1 | 2
    cards[`word:${wordId}`] = {
      box,
      due: addDays(word.lastPlayed, INTERVAL_DAYS[box]),
      seen: word.seen,
      known: word.known,
      missed: word.missed,
      lastPlayed: word.lastPlayed
    }
  }
  return { version: 2, cards, lastPlayed: v1.lastPlayed, streak: v1.streak }
}

function wordKey(wordId: string): CardKey {
  return encodeCardKey({ kind: 'word', id: wordId })
}

function wordProgressFromCards(cards: Record<string, CardProgress>): Record<string, WordProgress> {
  const words: Record<string, WordProgress> = {}
  for (const [key, card] of Object.entries(cards)) {
    if (!Object.hasOwn(cards, key)) continue
    const parts = decodeCardKey(key)
    if (parts?.kind !== 'word' || parts.suffix) continue
    words[parts.id] = { seen: card.seen, known: card.known, missed: card.missed, lastPlayed: card.lastPlayed }
  }
  return words
}

// Calendar dates use the browser's local timezone; UTC is only used to compare date labels.
function localDay() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Guest progress is browser-local and best effort: storage failures never interrupt play. */
export function useProgress() {
  const progress = useState<Progress>('heritage-progress', emptyProgress)
  const loaded = useState('heritage-progress-loaded', () => false)
  const today = ref(localDay())

  function persist(next: Progress) {
    progress.value = next
    try {
      window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Keep this session's progress even when storage is unavailable or full.
    }
  }

  function load() {
    if (!import.meta.client || loaded.value) return
    loaded.value = true
    try {
      const rawV2 = window.localStorage.getItem(PROGRESS_STORAGE_KEY)
      if (rawV2) {
        progress.value = decodeV2(rawV2)
        return
      }
      const legacy = decodeV1(window.localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY))
      if (legacy) {
        const migrated = migrateV1(legacy)
        progress.value = migrated
        try {
          window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(migrated))
        } catch {
          // Migration stays in memory only when storage write fails.
        }
        return
      }
      progress.value = emptyProgress()
    } catch {
      progress.value = emptyProgress()
    }
  }

  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    load()
    today.value = localDay()
    timer = setInterval(() => {
      today.value = localDay()
    }, 60_000)
  })
  onBeforeUnmount(() => clearInterval(timer))

  function touchStreak(previous: Progress): { lastPlayed: string, streak: number } {
    const gap = previous.lastPlayed ? dayNumber(today.value) - dayNumber(previous.lastPlayed) : Infinity
    return {
      lastPlayed: today.value,
      streak: gap === 0 ? previous.streak : gap === 1 ? previous.streak + 1 : 1
    }
  }

  function updateCard(key: string, updater: (current: CardProgress | undefined) => CardProgress) {
    if (!import.meta.client || !key) return
    load()
    today.value = localDay()
    const previous = progress.value
    const streakPatch = touchStreak(previous)
    const current = Object.hasOwn(previous.cards, key) ? previous.cards[key] : undefined
    persist({
      version: 2,
      cards: { ...previous.cards, [key]: updater(current) },
      ...streakPatch
    })
  }

  function record(wordId: string, action: 'seen' | 'known' | 'missed') {
    if (!import.meta.client || !wordId) return
    load()
    today.value = localDay()
    const previous = progress.value
    const streakPatch = touchStreak(previous)
    const key = wordKey(wordId)
    const oldCard = Object.hasOwn(previous.cards, key) ? previous.cards[key] : undefined
    let nextCard: CardProgress
    if (action === 'seen') {
      const base = oldCard ?? { box: 0, due: today.value, seen: 0, known: 0, missed: 0, lastPlayed: today.value }
      nextCard = { ...base, seen: base.seen + 1, lastPlayed: today.value }
    } else if (action === 'known') {
      nextCard = applyAnswer(oldCard, true, today.value, { countSeen: false })
    } else {
      nextCard = applyAnswer(oldCard, false, today.value, { countSeen: false })
    }
    persist({
      version: 2,
      cards: { ...previous.cards, [key]: nextCard },
      ...streakPatch
    })
  }

  const totals = computed(() => Object.values(progress.value.cards).reduce((sum, card) => ({
    seen: sum.seen + card.seen, known: sum.known + card.known, missed: sum.missed + card.missed
  }), { seen: 0, known: 0, missed: 0 }))
  const streak = computed(() => {
    const gap = progress.value.lastPlayed ? dayNumber(today.value) - dayNumber(progress.value.lastPlayed) : Infinity
    return gap === 0 || gap === 1 ? progress.value.streak : 0
  })

  function dueCount(keys?: CardKey[]) {
    load()
    today.value = localDay()
    const entries = keys
      ? keys.filter(key => Object.hasOwn(progress.value.cards, key)).map(key => progress.value.cards[key]!)
      : Object.values(progress.value.cards)
    return entries.filter(card => isDue(card, today.value)).length
  }

  function learnedCount(keys?: CardKey[]) {
    load()
    const entries = keys
      ? keys.filter(key => Object.hasOwn(progress.value.cards, key)).map(key => progress.value.cards[key]!)
      : Object.values(progress.value.cards)
    return entries.filter(isLearned).length
  }

  return {
    words: computed(() => readonly(wordProgressFromCards(progress.value.cards))),
    cards: computed(() => readonly(progress.value.cards)),
    totals,
    lastPlayed: computed(() => progress.value.lastPlayed),
    streak,
    recordSeen: (wordId: string) => record(wordId, 'seen'),
    recordKnown: (wordId: string) => record(wordId, 'known'),
    recordMissed: (wordId: string) => record(wordId, 'missed'),
    recordSeenCard: (key: CardKey) => updateCard(key, (current) => {
      const base = current ?? { box: 0, due: today.value, seen: 0, known: 0, missed: 0, lastPlayed: today.value }
      return { ...base, seen: base.seen + 1, lastPlayed: today.value }
    }),
    recordAnswer: (key: CardKey, knew: boolean) => updateCard(key, current => applyAnswer(current, knew, today.value)),
    dueCount,
    learnedCount
  }
}
