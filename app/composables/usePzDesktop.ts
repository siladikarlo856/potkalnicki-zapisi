// True from 1024px up, the design's breakpoint between phone layouts and desktop layouts.
// It starts false (so the server and the first client render agree on the phone layout) and
// follows the media query once mounted.
export function usePzDesktop() {
  const desktop = ref(false)

  onMounted(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(min-width: 1024px)')
    desktop.value = query.matches
    const onChange = (event: MediaQueryListEvent) => {
      desktop.value = event.matches
    }
    query.addEventListener('change', onChange)
    onScopeDispose(() => query.removeEventListener('change', onChange))
  })

  return desktop
}
