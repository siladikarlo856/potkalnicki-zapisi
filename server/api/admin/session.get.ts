export default defineEventHandler(async event => ({
  authenticated: (await useAdminSession(event)).data.authenticated === true
}))
