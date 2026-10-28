import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn(() => ({ from: vi.fn() })) }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('SUPABASE_URL', '')
  vi.stubEnv('SUPABASE_API_KEY', '')
  vi.stubGlobal('useRuntimeConfig', () => ({ supabase: { url: '', serviceRoleKey: '' } }))
  vi.stubGlobal('createError', (error: object) => Object.assign(new Error('Database is not configured'), error))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('shared server database client', () => {
  it('uses Hostinger settings and reuses the same client with session persistence disabled', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://hostinger.example')
    vi.stubEnv('SUPABASE_API_KEY', 'sb_secret_hostinger')
    const { useDatabaseClient } = await import('../server/utils/db')
    expect(useDatabaseClient()).toBe(useDatabaseClient())
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(createClient).toHaveBeenCalledWith('https://hostinger.example', 'sb_secret_hostinger', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    })
  })

  it('prefers the private Nuxt overrides', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://fallback.example')
    vi.stubEnv('SUPABASE_API_KEY', 'sb_secret_fallback')
    vi.stubGlobal('useRuntimeConfig', () => ({ supabase: { url: 'https://override.example', serviceRoleKey: 'sb_secret_override' } }))
    const { useDatabaseClient } = await import('../server/utils/db')
    useDatabaseClient()
    expect(createClient).toHaveBeenCalledWith('https://override.example', 'sb_secret_override', expect.any(Object))
  })

  it.each([
    { url: '', key: 'sb_secret_key', missing: 'NUXT_SUPABASE_URL (or SUPABASE_URL)' },
    { url: 'https://project.example', key: '', missing: 'NUXT_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_API_KEY)' }
  ])('fails closed and identifies the missing variable: $missing', async ({ url, key, missing }) => {
    vi.stubEnv('SUPABASE_URL', url)
    vi.stubEnv('SUPABASE_API_KEY', key)
    const { useDatabaseClient } = await import('../server/utils/db')
    expect(useDatabaseClient).toThrow(expect.objectContaining({ statusCode: 503 }))
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(`${missing} is not set`))
    expect(createClient).not.toHaveBeenCalled()
  })
})
