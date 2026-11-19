import { computed, onBeforeUnmount, watch } from 'vue'
import { zagrebDay } from '~~/shared/utils/dailyWord'
import type { DailyWordPayload } from '~~/shared/utils/dailyWord'

const RETRY_MS = 30_000

/**
 * Today's word, fetched on the client even on prerendered pages. The shared key means every
 * widget on the page makes one request. The server decides the day: the device clock only
 * schedules the refetch at `nextAt`, and a clock that is ahead is retried until the day changes.
 */
export function useDailyWord() {
  const { data, status, error, refresh } = useFetch<DailyWordPayload>('/api/heritage/daily', {
    key: 'heritage-daily-word', server: false
  })
  const payload = computed(() => data.value ?? undefined)
  /** Before the epoch the API answers 404 not-started and the section stays hidden. */
  const unavailable = computed(() => error.value?.statusCode === 404)
  const progress = useDailyProgress()
  watch([error, progress.loaded], ([failure, loaded]) => {
    if (import.meta.client && loaded && failure && !unavailable.value) progress.recordOutage(zagrebDay(new Date()))
  }, { immediate: true })

  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  async function rollover(previousDay: string) {
    await refresh()
    if (import.meta.client && !disposed && data.value?.day === previousDay) timer = setTimeout(() => rollover(previousDay), RETRY_MS)
  }
  watch(() => data.value?.nextAt, (nextAt) => {
    clearTimeout(timer)
    if (!import.meta.client || !nextAt || !data.value) return
    const day = data.value.day
    timer = setTimeout(() => rollover(day), Math.max(0, Date.parse(nextAt) - Date.now()))
  }, { immediate: true })
  onBeforeUnmount(() => {
    disposed = true
    clearTimeout(timer)
  })

  return { payload, status, error, unavailable, refresh }
}
