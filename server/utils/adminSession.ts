import type { H3Event, SessionConfig } from 'h3'

export const ADMIN_SESSION_PASSWORD_MIN_LENGTH = 32
export const ADMIN_SESSION_MAX_AGE = 12 * 60 * 60

interface AdminSessionData {
  authenticated?: boolean
}

function config(event: H3Event): SessionConfig | null {
  const password = useRuntimeConfig(event).adminSessionPassword
  if (!password || password.length < ADMIN_SESSION_PASSWORD_MIN_LENGTH) return null
  return {
    password,
    name: 'admin-session',
    maxAge: ADMIN_SESSION_MAX_AGE,
    sessionHeader: false,
    cookie: {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: ADMIN_SESSION_MAX_AGE
    }
  }
}

export function requireAdminSessionConfig(event: H3Event) {
  const sessionConfig = config(event)
  if (!sessionConfig) {
    throw createError({ statusCode: 503, statusMessage: 'Admin session is not configured' })
  }
  return sessionConfig
}

export async function useAdminSession(event: H3Event) {
  return useSession<AdminSessionData>(event, requireAdminSessionConfig(event))
}

export async function hasAdminSession(event: H3Event) {
  const sessionConfig = config(event)
  if (!sessionConfig) return false
  return (await useSession<AdminSessionData>(event, sessionConfig)).data.authenticated === true
}
