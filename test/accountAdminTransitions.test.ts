import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { promoteMaintainer, revokeMaintainer } from '../server/utils/accountAdmin'

const { getUserById, rpc } = vi.hoisted(() => ({ getUserById: vi.fn(), rpc: vi.fn() }))
vi.mock('../server/utils/db', () => ({
  useDatabaseClient: () => ({ auth: { admin: { getUserById } }, rpc }),
  databaseError: (error: { message: string }) => { throw new Error(error.message) }
}))

function googleUser(): User {
  return {
    id: 'target', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01',
    email: ' Legacy@Example.COM ',
    identities: [{
      id: 'google-sub', identity_id: 'identity', user_id: 'target', provider: 'google',
      identity_data: { email: 'legacy@example.com', email_verified: true }
    }]
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getUserById.mockResolvedValue({ data: { user: googleUser() }, error: null })
  rpc.mockResolvedValue({ error: null })
  vi.stubGlobal('createError', (error: { statusMessage: string }) => Object.assign(new Error(error.statusMessage), error))
})
afterEach(() => vi.unstubAllGlobals())

describe.each([
  ['promotion', promoteMaintainer, 'account_admin_promote_maintainer'],
  ['revocation', revokeMaintainer, 'account_admin_revoke_maintainer']
] as const)('%s target identity', (_, transition, name) => {
  it('supplies the verified Google email to the transactional role change', async () => {
    await transition('admin', 'target')
    expect(getUserById).toHaveBeenCalledWith('target')
    expect(rpc).toHaveBeenCalledExactlyOnceWith(name, {
      p_actor_id: 'admin', p_target_id: 'target', p_email: 'legacy@example.com'
    })
  })

  it.each(['unverified', 'non-Google', 'mismatched', 'missing'] as const)('refuses a %s target identity before changing a role', async (kind) => {
    const user = googleUser()
    if (kind === 'unverified') user.identities![0]!.identity_data!.email_verified = false
    if (kind === 'non-Google') user.identities![0]!.provider = 'email'
    if (kind === 'mismatched') user.email = 'someone-else@example.com'
    getUserById.mockResolvedValue({ data: { user: kind === 'missing' ? null : user }, error: null })
    await expect(transition('admin', 'target')).rejects.toMatchObject({ statusCode: 409 })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('does not change a role when the identity lookup fails', async () => {
    getUserById.mockResolvedValue({ data: { user: null }, error: { status: 404, message: 'not found' } })
    await expect(transition('admin', 'target')).rejects.toMatchObject({ statusCode: 404 })
    expect(rpc).not.toHaveBeenCalled()
  })
})
