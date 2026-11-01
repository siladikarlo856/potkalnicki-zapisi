export default defineNuxtPlugin(() => {
  useRouter().beforeEach((to) => {
    if (shouldTrackPath(to.path)) localStorage.removeItem('umami.disabled')
    else localStorage.setItem('umami.disabled', '1')
  })
})
