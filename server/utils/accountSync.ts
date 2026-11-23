import { createClient, type User } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import type { AccountRole } from '~~/shared/types/accounts'
import { databaseError, useDatabaseClient } from './db'

function supabaseAuthSettings() {
  const { supabase, public: pub } = useRuntimeConfig()
  return {
    url: supabase.url || process.env.SUPABASE_URL || pub.supabase.url || '',
    anonKey: pub.supabase.anonKey || '',
    bootstrapEmail: useRuntimeConfig().accountAdminBootstrapEmail || ''
  }
}

export function normalizeAccountEmail(email: string) {
  return email.trim().toLowerCase()
}

export function verifiedProviderEmail(user: User): string | null {
  const email = user.email ? normalizeAccountEmail(user.email) : ''
  if (!email) return null
  const verified = user.identities?.some(identity =>
    identity.provider === 'google'
    && identity.identity_data?.email_verified === true
    && typeof identity.identity_data.email === 'string'
    && normalizeAccountEmail(identity.identity_data.email) === email
  )
  return verified ? email : null
}

function readBearerToken(event: H3Event) {
  const header = getRequestHeader(event, 'authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
}

export async function resolveSignedInUser(accessToken: string) {
  const { url, anonKey } = supabaseAuthSettings()
  if (!url || !anonKey) {
    throw createError({ statusCode: 503, statusMessage: 'Supabase Auth is not configured' })
  }
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
  const { data, error } = await client.auth.getUser(accessToken)
  if (error || !data.user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired session' })
  }
  return data.user
}

export async function loadAccountRole(accountId: string): Promise<AccountRole> {
  const { data, error } = await useDatabaseClient().rpc('account_role_for_user', { p_user_id: accountId })
  if (error) databaseError(error)
  return (data ?? 'none') as AccountRole
}

export async function requireVerifiedAccount(event: H3Event): Promise<{ accountId: string }> {
  const accessToken = readBearerToken(event)
  if (!accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Missing bearer token' })
  }
  const user = await resolveSignedInUser(accessToken)
  if (!verifiedProviderEmail(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Verified email is required' })
  }
  return { accountId: user.id }
}

export async function syncSignedInAccount(event: H3Event): Promise<{ role: AccountRole }> {
  const accessToken = readBearerToken(event)
  if (!accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Missing bearer token' })
  }

  const user = await resolveSignedInUser(accessToken)
  const verifiedEmail = verifiedProviderEmail(user)
  if (!verifiedEmail) {
    throw createError({ statusCode: 403, statusMessage: 'Verified email is required' })
  }

  const bootstrapEmail = normalizeAccountEmail(supabaseAuthSettings().bootstrapEmail || '')
  const { data, error } = await useDatabaseClient().rpc('account_sync_signed_in', {
    p_account_id: user.id,
    p_email: verifiedEmail,
    p_bootstrap_email: bootstrapEmail || null
  })

  if (error) databaseError(error)
  const role = (data ?? 'none') as AccountRole
  return { role }
}
