export default defineEventHandler(async (event) => {
  const body = await readBody<{ password?: unknown }>(event)
  const password = typeof body?.password === 'string' ? body.password : ''
  verifyReviewerPassword(event, password)
  const session = await useAdminSession(event)
  await session.update({ authenticated: true })
  return { authenticated: true }
})
