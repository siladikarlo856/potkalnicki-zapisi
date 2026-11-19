import { computed, onBeforeUnmount, onMounted, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

/** "9 h 42 min" until the next word, on minute resolution. Not a live region, so it never announces itself. */
export function useDailyCountdown(nextAt: MaybeRefOrGetter<string | undefined>) {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    now.value = Date.now()
    timer = setInterval(() => {
      now.value = Date.now()
    }, 60_000)
  })
  onBeforeUnmount(() => clearInterval(timer))
  return computed(() => {
    const target = toValue(nextAt)
    if (!target) return ''
    const minutes = Math.max(0, Math.ceil((Date.parse(target) - now.value) / 60_000))
    const hours = Math.floor(minutes / 60)
    return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`
  })
}
