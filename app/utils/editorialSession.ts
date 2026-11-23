import type { SupabaseClient } from '@supabase/supabase-js'

export function withEditorialSessionLock<T>(action: () => Promise<T>): Promise<T> {
  return navigator.locks.request('pz-editorial-session', action)
}

export async function syncEditorialSessionCookie(client: SupabaseClient | null) {
  if (!import.meta.client) return
  await withEditorialSessionLock(async () => {
    let accessToken = (await client?.auth.getSession())?.data.session?.access_token ?? null
    while (true) {
      try {
        await $fetch('/api/admin/social-session', accessToken
          ? { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }
          : { method: 'DELETE' })
      } catch (error) {
        if (accessToken || (error as { statusCode?: number }).statusCode !== 401) throw error
      }
      const currentToken = (await client?.auth.getSession())?.data.session?.access_token ?? null
      if (currentToken === accessToken) return
      accessToken = currentToken
    }
  })
}
