export default defineEventHandler((event) => {
  deleteCookie(event, 'admin-session', {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  })
  return { authenticated: false }
})
