import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { integrationDb } from './support/integrationDb'

// Account metadata is the only public-facing schema addition. This suite runs against the
// disposable Postgres created by scripts/test-challenges.mjs; it must never use a shared database.
const db = await integrationDb()
const { sql, failure } = db

const accountA = '00000000-0000-4000-8000-000000000001'
const accountB = '00000000-0000-4000-8000-000000000002'
const publishedSettlement = 'c9731a87-1dee-807a-94ed-83d47b96fad2'

function asAccount(id?: string) {
  const body = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ role: 'authenticated', sub: id, exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url')
  ].join('.')
  const token = `${body}.${createHmac('sha256', process.env.TEST_CHALLENGE_JWT_SECRET!).update(body).digest('base64url')}`
  return createClient(db.url, db.publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
}

describe.skipIf(!db.enabled)('account profile security on Postgres', () => {
  beforeAll(() => {
    sql(`insert into public.account_profiles(id) values ('${accountB}');`)
  })

  it('creates only the signed-in account profile', async () => {
    const own = asAccount(accountA)
    const created = await own.from('account_profiles').insert({ id: accountA }).select().single()
    expect(created.error).toBeNull()
    expect(created.data).toMatchObject({ id: accountA, role: 'none', main_place_id: null })

    const crossAccount = await own.from('account_profiles').insert({ id: '00000000-0000-4000-8000-000000000003' })
    expect(crossAccount.error?.code).toBe('42501')
    const roleWrite = await asAccount('00000000-0000-4000-8000-000000000004')
      .from('account_profiles').insert({ id: '00000000-0000-4000-8000-000000000004', role: 'admin' })
    expect(roleWrite.error?.code).toBe('42501')
  })

  it.each(['none', 'maintainer', 'admin'])('allows own preferences and enforces isolation for role %s', async (role) => {
    const id = `00000000-0000-4000-8000-00000000001${['none', 'maintainer', 'admin'].indexOf(role)}`
    const own = asAccount(id)
    expect((await own.from('account_profiles').insert({ id })).error).toBeNull()
    expect((await db.service.from('account_profiles').update({ role }).eq('id', id)).error).toBeNull()

    for (const main_place_id of [publishedSettlement, null]) {
      const updated = await own.from('account_profiles').update({ main_place_id }).eq('id', id).select('id, role, main_place_id')
      expect(updated.error).toBeNull()
      expect(updated.data).toEqual([{ id, role, main_place_id }])
    }

    const visible = await own.from('account_profiles').select('id')
    expect(visible.error).toBeNull()
    expect(visible.data).toEqual([{ id }])
    const crossAccount = await own.from('account_profiles').update({ main_place_id: publishedSettlement }).eq('id', accountB).select()
    expect(crossAccount.error).toBeNull()
    expect(crossAccount.data).toEqual([])
    expect(sql(`select main_place_id is null from public.account_profiles where id = '${accountB}';`)).toBe('t')
    expect((await own.from('account_profiles').update({ role: 'admin' }).eq('id', id)).error?.code).toBe('42501')
    expect((await own.from('account_profiles').update({ id: accountB }).eq('id', id)).error?.code).toBe('42501')

    const invalidPlace = await own.from('account_profiles').update({ main_place_id: '92140ed6-6420-81d0-8661-91ce0c257f5f' }).eq('id', id)
    expect(invalidPlace.error?.message).toMatch(/published Naselje/)
    expect((await db.service.rpc('account_role_for_user', { p_user_id: id })).data).toBe(role)
  })

  it('does not expose profiles or accept writes without an account subject', async () => {
    const own = asAccount()
    const visible = await own.from('account_profiles').select('id')
    expect(visible.error).toBeNull()
    expect(visible.data).toEqual([])
    const updated = await own.from('account_profiles').update({ main_place_id: publishedSettlement }).eq('id', accountB).select()
    expect(updated.error).toBeNull()
    expect(updated.data).toEqual([])
    expect((await own.from('account_profiles').insert({ id: '00000000-0000-4000-8000-000000000005' })).error?.code).toBe('42501')
  })

  it('keeps pending emails, audit rows, and existing content tables server-only', () => {
    for (const table of ['account_pending_emails', 'account_role_audit', 'areas', 'heritage_words', 'heritage_submissions']) {
      expect(failure(`set role anon; select count(*) from public.${table};`), table).toMatch(/permission denied/)
      expect(failure(`set role authenticated; select count(*) from public.${table};`), table).toMatch(/permission denied/)
    }
    expect(failure(`set role authenticated; insert into public.account_pending_emails(email) values ('editor@example.com');`)).toMatch(/permission denied/)
    expect(failure(`set role authenticated; insert into public.account_role_audit(action, target_email) values ('grant_maintainer', 'editor@example.com');`)).toMatch(/permission denied/)
  })
})
