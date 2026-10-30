// In-page links (#heritage, #doprinos, #contact…) only scroll, so keyboard focus stays on
// the link and the next Tab jumps back to where it was. Move focus to the target section,
// without scrolling, so Tab continues from there and screen readers read on from it.
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()

  function focusTarget(hash: string) {
    let id: string
    try {
      id = decodeURIComponent(hash.slice(1))
    } catch {
      return
    }
    const target = document.getElementById(id)
    if (!target) return
    if (!target.matches('a[href], button, input, select, textarea, [tabindex]')) {
      target.setAttribute('tabindex', '-1')
      target.style.outline = 'none'
    }
    target.focus({ preventScroll: true })
  }

  router.afterEach((to, from, failure) => {
    // The very first page load is left to the browser, which handles fragments itself.
    if (failure || !to.hash || !from.matched.length) return
    if (to.path === from.path) {
      nextTick(() => focusTarget(to.hash))
    } else {
      // Another page: wait until it has rendered, as Nuxt's own hash scrolling does.
      nuxtApp.hooks.hookOnce('page:loading:end', () => {
        requestAnimationFrame(() => {
          if (router.currentRoute.value.fullPath === to.fullPath) focusTarget(to.hash)
        })
      })
    }
  })
})
