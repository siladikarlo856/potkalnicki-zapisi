import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// Supabase (Postgres) clients. They exist only in server code: no key is ever sent to the browser.
//
// Settings come from runtime config (NUXT_SUPABASE_URL, NUXT_SUPABASE_ANON_KEY,
// NUXT_SUPABASE_SERVICE_ROLE_KEY) or, when those are empty, from the plain names that Hostinger's
// Supabase integration and Supabase's own docs use (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_KEY).
//
// Two roles, because Row Level Security keeps the table closed to the public key:
//   * the anon key can only insert a new pending submission (see supabase/migrations);
//   * the service-role key lists, approves, rejects and deletes, and only /review uses it.

const clients = new Map<string, SupabaseClient>()

function supabaseSettings() {
  const { supabase } = useRuntimeConfig()
  return {
    url: supabase.url || process.env.SUPABASE_URL || '',
    anonKey: supabase.anonKey || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '',
    serviceRoleKey: supabase.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
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

// For the public form. Falls back to the service-role key only when no anon key is set.
export function useSubmissionClient() {
  const { url, anonKey, serviceRoleKey } = supabaseSettings()
  if (!url) notConfigured('NUXT_SUPABASE_URL (or SUPABASE_URL)')
  const key = anonKey || serviceRoleKey
  if (!key) notConfigured('NUXT_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)')
  return clientFor(url, key)
}

// For the review page only. Without the service-role key, review stays switched off.
export function useReviewClient() {
  const { url, serviceRoleKey } = supabaseSettings()
  if (!url) notConfigured('NUXT_SUPABASE_URL (or SUPABASE_URL)')
  if (!serviceRoleKey) notConfigured('NUXT_SUPABASE_SERVICE_ROLE_KEY')
  return clientFor(url, serviceRoleKey)
}

export function databaseError(error: { message: string }): never {
  console.error('[db] Supabase request failed:', error.message)
  throw createError({ statusCode: 500, statusMessage: 'Database error' })
}
