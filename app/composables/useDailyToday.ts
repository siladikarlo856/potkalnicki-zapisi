import { computed } from 'vue'

/**
 * Today's word and this device's result for it, in one place for the card on the hubs and the /rijec-dana/ page.
 * The word fetch is shared by key, so every widget on a page makes one request.
 */
export function useDailyToday() {
  const { payload, status, error, unavailable, refresh } = useDailyWord()
  const progress = useDailyProgress()

  const stored = computed(() => payload.value ? progress.days.value[payload.value.day] : undefined)
  /** The visitor already played a different word today: it was withdrawn and replaced afterwards. */
  const replaced = computed(() => !!payload.value && !!stored.value && stored.value.wordId !== payload.value.entry.id)
  const finished = computed(() => stored.value?.done ? stored.value : undefined)
  const solvedStreak = computed(() => payload.value ? progress.solvedStreakFor(payload.value.day) : 0)
  const brokenStreak = computed(() => payload.value ? progress.brokenStreakFor(payload.value.day) : 0)
  const loading = computed(() => !error.value && (status.value === 'idle' || status.value === 'pending') && !payload.value)
  const ready = computed(() => !!payload.value && progress.loaded.value)

  return { payload, status, error, unavailable, refresh, progress, stored, replaced, finished, solvedStreak, brokenStreak, loading, ready }
}
