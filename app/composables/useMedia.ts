/**
 * A reactive `matchMedia` query. Server-side and before mount it answers `initial`, so the first client render
 * matches the server's and the real answer follows on mount.
 */
export function useMedia(query: string, initial = false) {
  const matches = ref(initial)
  if (import.meta.client) {
    onMounted(() => {
      const list = window.matchMedia(query)
      matches.value = list.matches
      const update = (event: MediaQueryListEvent) => {
        matches.value = event.matches
      }
      list.addEventListener('change', update)
      onBeforeUnmount(() => list.removeEventListener('change', update))
    })
  }
  return matches
}

/** `navigator.onLine`, kept current. Assumes online until the browser says otherwise. */
export function useOnlineState() {
  const online = ref(true)
  if (import.meta.client) {
    onMounted(() => {
      online.value = navigator.onLine
      const up = () => {
        online.value = true
      }
      const down = () => {
        online.value = false
      }
      window.addEventListener('online', up)
      window.addEventListener('offline', down)
      onBeforeUnmount(() => {
        window.removeEventListener('online', up)
        window.removeEventListener('offline', down)
      })
    })
  }
  return online
}

/**
 * The admin's control size (40-nuxt-ui.md section 4): 36px controls with a fine pointer from 768px, the public 44px
 * sizes with a coarse pointer or on a phone.
 */
export function useDensity() {
  const dense = useMedia('(min-width: 768px) and (pointer: fine)')
  return computed(() => (dense.value ? 'md' : 'xl') as 'md' | 'xl')
}
