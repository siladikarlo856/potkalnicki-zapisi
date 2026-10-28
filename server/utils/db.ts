import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// One server-only secret-key client for submissions and review. The key bypasses RLS;
// the submission route validates every field and review still requires its own password.

const clients = new Map<string, SupabaseClient>()

function supabaseSettings() {
  const { supabase } = useRuntimeConfig()
  return {
    url: supabase.url || process.env.SUPABASE_URL || '',
    serviceRoleKey: supabase.serviceRoleKey || process.env.SUPABASE_API_KEY || ''
  }
}

function notConfigured(missing: string): never {
  console.error(`[db] ${missing} is not set: Supabase is not configured, so this part of the site is switched off.`)
  throw createError({ statusCode: 503, statusMessage: 'Database is not configured' })
}

function clientFor(url: string, key: string) {
  const id = `${url}\n${key}`
  let client = clients.get(id)
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    })
    clients.set(id, client)
  }
  return client
}

export function useDatabaseClient() {
  const { url, serviceRoleKey } = supabaseSettings()
  if (!url) notConfigured('NUXT_SUPABASE_URL (or SUPABASE_URL)')
  if (!serviceRoleKey) notConfigured('NUXT_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_API_KEY)')
  return clientFor(url, serviceRoleKey)
}

export function databaseError(error: { message: string }): never {
  console.error('[db] Supabase request failed:', error.message)
  throw createError({ statusCode: 500, statusMessage: 'Database error' })
}
