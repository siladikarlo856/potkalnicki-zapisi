import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'

const { createClient, rpc, getUser, roleRpc } = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
  getUser: vi.fn(),
  roleRpc: vi.fn()
}))

vi.mock('@supabase/supabase-js', () => ({ createClient }))
vi.mock('../server/utils/db', () => ({
  useDatabaseClient: () => ({
    rpc: (name: string, args?: object) => (name === 'account_role_for_user' ? roleRpc(args) : rpc(name, args))
  }),
  databaseError: (error: { message: string }) => {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }
}))

function user(partial: Partial<User> & Pick<User, 'id'>): User {
  return {
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
    ...partial
  } as User
}

function googleIdentity(partial: Partial<NonNullable<User['identities']>[number]> = {}) {
  return {
    id: 'google-subject',
    identity_id: 'google-identity',
    user_id: 'u1',
    provider: 'google',
    identity_data: { email: 'admin@example.com', email_verified: true },
    ...partial
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  createClient.mockReturnValue({ auth: { getUser } })
  rpc.mockResolvedValue({ data: 'none', error: null })
  roleRpc.mockResolvedValue({ data: 'none', error: null })
  vi.stubGlobal('useRuntimeConfig', () => ({
    supabase: { url: 'https://project.example', serviceRoleKey: 'service' },
    public: { supabase: { url: 'https://project.example', anonKey: 'anon' } },
    accountAdminBootstrapEmail: 'admin@example.com'
  }))
  vi.stubGlobal('createError', (error: object) => Object.assign(new Error('error'), error))
  vi.stubGlobal('getRequestHeader', () => 'Bearer access-token')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('verifiedProviderEmail', () => {
  it('accepts matching Google-verified emails with case and whitespace normalization', async () => {
    const { verifiedProviderEmail, normalizeAccountEmail } = await import('../server/utils/accountSync')
    expect(normalizeAccountEmail('  Admin@Example.COM ')).toBe('admin@example.com')
    expect(verifiedProviderEmail(user({
      id: 'u1',
      email: ' Admin@Example.COM ',
      identities: [googleIdentity({ identity_data: { email: ' ADMIN@example.com ', email_verified: true } })]
    }))).toBe('admin@example.com')
  })

  it.each([null, '', '  '])('refuses an absent account email (%j)', async (email) => {
    const { verifiedProviderEmail } = await import('../server/utils/accountSync')
    expect(verifiedProviderEmail(user({ id: 'u1', email, identities: [googleIdentity()] }))).toBeNull()
  })
})

describe('syncSignedInAccount', () => {
  it.each([
    { name: 'missing identities', identities: undefined },
    { name: 'empty identities', identities: [] },
    { name: 'a non-Google identity', identities: [googleIdentity({ provider: 'github' })] },
    { name: 'an unverified Google email', identities: [googleIdentity({ identity_data: { email: 'admin@example.com', email_verified: false } })] },
    { name: 'a missing verification flag', identities: [googleIdentity({ identity_data: { email: 'admin@example.com' } })] },
    { name: 'a string verification flag', identities: [googleIdentity({ identity_data: { email: 'admin@example.com', email_verified: 'true' } })] },
    { name: 'a mismatched Google email', identities: [googleIdentity({ identity_data: { email: 'other@example.com', email_verified: true } })] },
    { name: 'missing identity data', identities: [googleIdentity({ identity_data: undefined })] },
    { name: 'a missing identity email', identities: [googleIdentity({ identity_data: { email_verified: true } })] },
    { name: 'a non-string identity email', identities: [googleIdentity({ identity_data: { email: 123, email_verified: true } })] },
    {
      name: 'verification split between identities',
      identities: [
        googleIdentity({ identity_data: { email: 'other@example.com', email_verified: true } }),
        googleIdentity({ provider: 'email' })
      ]
    }
  ])('refuses $name before role writes', async ({ identities }) => {
    getUser.mockResolvedValue({
      data: { user: user({ id: 'u1', email: 'admin@example.com', email_confirmed_at: '2026-01-01', identities }) },
      error: null
    })
    const { syncSignedInAccount } = await import('../server/utils/accountSync')
    await expect(syncSignedInAccount({} as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('refuses an auto-confirmed password account claiming the bootstrap email', async () => {
    getUser.mockResolvedValue({
      data: {
        user: user({
          id: 'u1',
          email: 'admin@example.com',
          email_confirmed_at: '2026-01-01',
          confirmed_at: '2026-01-01',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: { email: 'admin@example.com', email_verified: true },
          identities: [googleIdentity({ provider: 'email' })]
        })
      },
      error: null
    })
    const { syncSignedInAccount } = await import('../server/utils/accountSync')
    await expect(syncSignedInAccount({} as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('syncs Google-verified accounts through the service-role bootstrap function', async () => {
    getUser.mockResolvedValue({
      data: { user: user({ id: 'u1', email: 'Admin@Example.COM', identities: [googleIdentity()] }) },
      error: null
    })
    rpc.mockResolvedValue({ data: 'admin', error: null })
    const { syncSignedInAccount } = await import('../server/utils/accountSync')
    await expect(syncSignedInAccount({} as never)).resolves.toEqual({ role: 'admin' })
    expect(getUser).toHaveBeenCalledWith('access-token')
    expect(rpc).toHaveBeenCalledWith('account_sync_signed_in', {
      p_account_id: 'u1',
      p_email: 'admin@example.com',
      p_bootstrap_email: 'admin@example.com'
    })
  })
})

describe('loadAccountRole', () => {
  it('reads the current role from account_profiles on each call', async () => {
    roleRpc.mockResolvedValueOnce({ data: 'maintainer', error: null })
    const { loadAccountRole } = await import('../server/utils/accountSync')
    await expect(loadAccountRole('u1')).resolves.toBe('maintainer')
    expect(roleRpc).toHaveBeenCalledWith({ p_user_id: 'u1' })
  })
})
