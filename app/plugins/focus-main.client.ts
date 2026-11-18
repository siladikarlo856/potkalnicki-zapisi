export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  router.afterEach(async () => {
    await nextTick()
    const main = document.querySelector<HTMLElement>('#main-content')
    if (main && document.activeElement === document.body) main.focus({ preventScroll: true })
  })
  nuxtApp.hook('app:mounted', () => {
    document.querySelector<HTMLElement>('#main-content')?.setAttribute('aria-live', 'polite')
  })
})
