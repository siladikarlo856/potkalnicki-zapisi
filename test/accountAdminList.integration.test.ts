import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { listAccountsAdmin, cancelPendingEmail } from '../server/utils/accountAdmin'
import { integrationDb } from './support/integrationDb'

const db = await integrationDb()
const adminId = '42000000-0000-4000-8000-000000000001'
const specialEmails = ['anna_smith', 'anna%smith', 'anna\\smith', 'annaxsmith']
const legacyIds = Array.from({ length: 12 }, (_, index) => `42000000-0000-4000-8000-0000000002${String(index).padStart(2, '0')}`)
const backfill = readFileSync(new URL('../supabase/migrations/20261122140000_account_verified_email_backfill.sql', import.meta.url), 'utf8')

describe.skipIf(!db.enabled)('account and pending email listing', () => {
  beforeAll(() => {
    vi.stubGlobal('useRuntimeConfig', () => ({ supabase: { url: db.url, serviceRoleKey: db.serviceKey } }))
    db.sql(`insert into public.account_profiles (id, email, role) values ('${adminId}', 'admin@list.test', 'admin');
      insert into public.account_profiles (id, email, created_at)
      select ('42000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
        'person' || n || '@pagination.test', '2020-01-01' from generate_series(10, 35) n;
      insert into public.account_pending_emails (email, created_at)
      select 'person' || n || '@pagination.test', '2020-01-01' from generate_series(10, 35) n;
      insert into public.account_pending_emails (email, status, created_at)
      select 'history' || n || '@pagination.test',
        case when n % 2 = 0 then 'consumed' else 'cancelled' end::public.account_pending_email_status,
        '2021-01-01' from generate_series(1, 101) n;`)
    for (const [index, email] of specialEmails.entries()) {
      db.sql(`insert into public.account_profiles (id, email)
        values ('42000000-0000-4000-8000-00000000010${index}', '${email}@literal.test');
        insert into public.account_pending_emails (email) values ('${email}@literal.test');`)
    }
  })

  afterAll(() => vi.unstubAllGlobals())

  it.each(specialEmails.slice(0, 3))('searches for %s literally in both tables', async (email) => {
    const result = await listAccountsAdmin(email.toUpperCase(), 1)
    expect(result.accounts.map(row => row.email)).toEqual([`${email}@literal.test`])
    expect(result.pending.map(row => row.email)).toEqual([`${email}@literal.test`])
    expect(result.accountsTotal).toBe(1)
    expect(result.pendingTotal).toBe(1)
  })

  it('pages through all open grants despite newer closed history and cancels a second-page grant', async () => {
    const first = await listAccountsAdmin('@pagination.test', 1)
    const second = await listAccountsAdmin('@pagination.test', 2, 2)
    expect(first.accountsTotal).toBe(26)
    expect(first.pendingTotal).toBe(26)
    expect(first.accounts).toHaveLength(25)
    expect(first.pending).toHaveLength(25)
    expect(second.accounts).toHaveLength(1)
    expect(second.pending).toHaveLength(1)
    expect(new Set([...first.accounts, ...second.accounts].map(row => row.id)).size).toBe(26)
    expect(new Set([...first.pending, ...second.pending].map(row => row.id)).size).toBe(26)
    expect([...first.pending, ...second.pending].every(row => row.status === 'pending')).toBe(true)
    const target = second.pending[0]!
    const searched = await listAccountsAdmin(target.email, 1)
    expect(searched.pending.map(row => row.id)).toEqual([target.id])
    await cancelPendingEmail(adminId, target.id)
    expect((await listAccountsAdmin(target.email, 1)).pending).toEqual([])
    expect(db.sql(`select status::text from public.account_pending_emails where id = '${target.id}';`)).toBe('cancelled')
  })

  it('backfills trusted legacy accounts before listing and search without changing their access or preferences', async () => {
    for (const [index, role] of (['none', 'maintainer', 'admin'] as const).entries()) {
      const id = legacyIds[index]!
      db.sql(`insert into public.account_profiles (id, role, main_place_id)
        values ('${id}', '${role}', 'c9731a87-1dee-807a-94ed-83d47b96fad2');
        insert into auth.users (id, email) values ('${id}', '  Legacy_${role}@Legacy-Listing.TEST ');
        insert into auth.identities (user_id, provider, identity_data)
        values ('${id}', 'google', '{"email":"legacy_${role}@legacy-listing.test","email_verified":true}');`)
    }
    const pending = await db.service.rpc('account_admin_preauthorize_maintainer', {
      p_actor_id: adminId, p_email: 'legacy_none@legacy-listing.test'
    })
    expect(pending.error).toBeNull()
    const auditBefore = db.sql('select count(*) from public.account_role_audit where target_email like \'%@legacy-listing.test\';')
    expect((await listAccountsAdmin('@legacy-listing.test', 1)).accounts).toEqual([])
    db.sql(backfill)
    for (const [index, role] of (['none', 'maintainer', 'admin'] as const).entries()) {
      const result = await listAccountsAdmin(`LEGACY_${role}@legacy-listing.test`, 1)
      expect(result.accounts).toMatchObject([{ id: legacyIds[index], email: `legacy_${role}@legacy-listing.test`, role }])
      expect(result.accountsTotal).toBe(1)
      expect(db.sql(`select main_place_id::text from public.account_profiles where id = '${legacyIds[index]}';`)).toBe('c9731a87-1dee-807a-94ed-83d47b96fad2')
    }
    const first = await listAccountsAdmin('@legacy-listing.test', 1, 1, 2)
    const second = await listAccountsAdmin('@legacy-listing.test', 2, 1, 2)
    expect(first.accountsTotal).toBe(3)
    expect(first.accounts).toHaveLength(2)
    expect(second.accounts).toHaveLength(1)
    expect(new Set([...first.accounts, ...second.accounts].map(row => row.id)).size).toBe(3)
    expect(db.sql(`select status::text from public.account_pending_emails where id = '${pending.data}';`)).toBe('pending')
    expect(db.sql('select count(*) from public.account_role_audit where target_email like \'%@legacy-listing.test\';')).toBe(auditBefore)
  })

  it('leaves untrusted, absent, and already stored emails unchanged during backfill', () => {
    const identities = [
      { provider: 'google', email: 'unverified@legacy-untrusted.test', email_verified: false },
      { provider: 'google', email: 'string-flag@legacy-untrusted.test', email_verified: 'true' },
      { provider: 'email', email: 'password@legacy-untrusted.test', email_verified: true },
      { provider: 'google', email: 'different@legacy-untrusted.test', email_verified: true },
      { provider: 'google', email: 123, email_verified: true },
      { provider: 'google', email: 'missing-flag@legacy-untrusted.test' }
    ]
    for (const [index, identity] of identities.entries()) {
      const id = legacyIds[index + 3]!
      const accountEmail = index === 3 ? 'mismatched@legacy-untrusted.test' : index === 4 ? '123' : identity.email
      db.sql(`insert into public.account_profiles (id) values ('${id}');
        insert into auth.users (id, email) values ('${id}', '${accountEmail}');
        insert into auth.identities (user_id, provider, identity_data)
        values ('${id}', '${identity.provider}', '${JSON.stringify(identity)}');`)
    }
    const storedId = legacyIds[9]!
    const orphanId = legacyIds[10]!
    const authOnlyId = legacyIds[11]!
    db.sql(`insert into public.account_profiles (id, email) values ('${storedId}', 'stored@legacy-untrusted.test');
      insert into auth.users (id, email) values ('${storedId}', 'new@legacy-untrusted.test'), ('${authOnlyId}', 'auth-only@legacy-untrusted.test');
      insert into auth.identities (user_id, provider, identity_data)
      values ('${storedId}', 'google', '{"email":"new@legacy-untrusted.test","email_verified":true}'),
        ('${authOnlyId}', 'google', '{"email":"auth-only@legacy-untrusted.test","email_verified":true}');
      insert into public.account_profiles (id) values ('${orphanId}');`)
    db.sql(backfill)
    expect(db.sql(`select count(*) from public.account_profiles where id in (${legacyIds.slice(3, 9).map(id => `'${id}'`).join(',')}) and email is not null;`)).toBe('0')
    expect(db.sql(`select email from public.account_profiles where id = '${storedId}';`)).toBe('stored@legacy-untrusted.test')
    expect(db.sql(`select email is null from public.account_profiles where id = '${orphanId}';`)).toBe('t')
    expect(db.sql(`select count(*) from public.account_profiles where id = '${authOnlyId}';`)).toBe('0')
  })
})
