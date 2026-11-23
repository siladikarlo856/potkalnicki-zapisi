import { beforeAll, describe, expect, it } from 'vitest'
import { integrationDb } from './support/integrationDb'

const db = await integrationDb()
const { sql, service } = db

const adminActor = '40000000-0000-4000-8000-000000000001'
const newUser = '40000000-0000-4000-8000-000000000002'
const maintainer = '40000000-0000-4000-8000-000000000003'
const staleGrantAccounts = ['40000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000005']
const legacyAccounts = ['40000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000007']
const fixtureIds = [adminActor, newUser, maintainer, ...staleGrantAccounts, ...legacyAccounts].map(id => `'${id}'`).join(', ')

function roleFor(id: string) {
  return sql(`select role::text from public.account_profiles where id = '${id}';`)
}

async function sync(accountId: string, email: string) {
  return service.rpc('account_sync_signed_in', {
    p_account_id: accountId,
    p_email: email,
    p_bootstrap_email: null
  })
}

describe.skipIf(!db.enabled)('account maintainer management', () => {
  beforeAll(() => {
    sql(`delete from public.account_role_audit where target_account_id in (${fixtureIds}) or target_email like '%@account-management.test';`)
    sql(`delete from public.account_pending_emails where email_normalized like '%@account-management.test';`)
    sql(`delete from public.account_profiles where id in (${fixtureIds});`)
    sql(`insert into public.account_profiles (id, email, role) values ('${adminActor}', 'admin@account-management.test', 'admin')
      on conflict (id) do update set email = excluded.email, role = excluded.role;`)
  })

  it('pre-authorises, matches on first sign-in case-insensitively, and records audit', async () => {
    const pending = await service.rpc('account_admin_preauthorize_maintainer', {
      p_actor_id: adminActor,
      p_email: '  Editor@Account-Management.TEST '
    })
    expect(pending.error).toBeNull()
    const matched = await sync(newUser, 'editor@account-management.test')
    expect(matched.error).toBeNull()
    expect(matched.data).toBe('maintainer')
    expect(roleFor(newUser)).toBe('maintainer')
    expect(Number(sql(`select count(*) from public.account_role_audit where action = 'grant_maintainer' and target_account_id = '${newUser}';`))).toBeGreaterThanOrEqual(1)
    expect(sql(`select status::text from public.account_pending_emails where lower(email) = 'editor@account-management.test' limit 1;`)).toBe('consumed')
  })

  it('cancels a pending row before match', async () => {
    const pending = await service.rpc('account_admin_preauthorize_maintainer', {
      p_actor_id: adminActor,
      p_email: 'cancel@account-management.test'
    })
    expect(pending.error).toBeNull()
    const cancel = await service.rpc('account_admin_cancel_pending', {
      p_actor_id: adminActor,
      p_pending_id: pending.data
    })
    expect(cancel.error).toBeNull()
    expect(sql(`select status::text from public.account_pending_emails where id = '${pending.data}';`)).toBe('cancelled')
    expect(Number(sql(`select count(*) from public.account_role_audit where action = 'cancel_pending' and pending_email_id = '${pending.data}';`))).toBe(1)
  })

  it('promotes a role-less account and revokes a maintainer', async () => {
    await sync(maintainer, 'maintainer@account-management.test')
    expect(roleFor(maintainer)).toBe('none')
    const promote = await service.rpc('account_admin_promote_maintainer', {
      p_actor_id: adminActor,
      p_target_id: maintainer,
      p_email: 'maintainer@account-management.test'
    })
    expect(promote.error).toBeNull()
    expect(roleFor(maintainer)).toBe('maintainer')
    const revoke = await service.rpc('account_admin_revoke_maintainer', {
      p_actor_id: adminActor,
      p_target_id: maintainer,
      p_email: 'maintainer@account-management.test'
    })
    expect(revoke.error).toBeNull()
    expect(roleFor(maintainer)).toBe('none')
    expect(Number(sql(`select count(*) from public.account_role_audit where action = 'revoke_role' and target_account_id = '${maintainer}';`))).toBe(1)
  })

  it('refuses self-revocation and granting admin through preauthorize UI path', async () => {
    const self = await service.rpc('account_admin_revoke_maintainer', {
      p_actor_id: adminActor,
      p_target_id: adminActor,
      p_email: 'admin@account-management.test'
    })
    expect(self.error?.message).toMatch(/revoke themself/)
    await service.rpc('account_admin_promote_maintainer', { p_actor_id: adminActor, p_target_id: maintainer, p_email: 'maintainer@account-management.test' })
    const nonAdmin = await service.rpc('account_admin_preauthorize_maintainer', {
      p_actor_id: maintainer,
      p_email: 'blocked@account-management.test'
    })
    expect(nonAdmin.error?.message).toMatch(/social admin role required/)
  })

  it.each(['before', 'after'] as const)('settles a pending grant created %s promotion before revocation', async (timing) => {
    const accountId = staleGrantAccounts[timing === 'before' ? 0 : 1]!
    const email = `${timing}@account-management.test`
    expect((await sync(accountId, email)).error).toBeNull()
    const preauthorize = () => service.rpc('account_admin_preauthorize_maintainer', {
      p_actor_id: adminActor, p_email: email.toUpperCase()
    })
    const earlierPending = timing === 'before' ? await preauthorize() : null
    if (earlierPending) expect(earlierPending.error).toBeNull()
    expect((await service.rpc('account_admin_promote_maintainer', {
      p_actor_id: adminActor, p_target_id: accountId, p_email: email
    })).error).toBeNull()
    expect(roleFor(accountId)).toBe('maintainer')
    const pending = earlierPending ?? await preauthorize()
    expect(pending.error).toBeNull()
    const pendingId = pending.data
    if (timing === 'before') {
      expect(sql(`select status::text from public.account_pending_emails where id = '${pendingId}';`)).toBe('consumed')
      expect(sql(`select matched_account_id::text from public.account_pending_emails where id = '${pendingId}';`)).toBe(accountId)
      expect(sql(`select pending_email_id::text from public.account_role_audit where target_account_id = '${accountId}' and details->>'source' = 'promote';`)).toBe(pendingId)
    }
    expect((await service.rpc('account_admin_revoke_maintainer', {
      p_actor_id: adminActor, p_target_id: accountId, p_email: email
    })).error).toBeNull()
    expect(sql(`select status::text from public.account_pending_emails where id = '${pendingId}';`)).toBe(timing === 'before' ? 'consumed' : 'cancelled')
    if (timing === 'after') {
      expect(sql(`select actor_id::text from public.account_role_audit where action = 'cancel_pending' and pending_email_id = '${pendingId}';`)).toBe(adminActor)
    }
    const nextSync = await sync(accountId, email)
    expect(nextSync.error).toBeNull()
    expect(nextSync.data).toBe('none')
    expect(roleFor(accountId)).toBe('none')
    expect((await preauthorize()).error).toBeNull()
    expect((await sync(accountId, email)).data).toBe('maintainer')
  })

  it.each(['none', 'maintainer'] as const)('reconciles legacy %s profiles without a stored email', async (role) => {
    const accountId = legacyAccounts[role === 'none' ? 0 : 1]!
    const email = `legacy-${role}@account-management.test`
    sql(`insert into public.account_profiles (id, role) values ('${accountId}', '${role}');`)
    const pending = await service.rpc('account_admin_preauthorize_maintainer', {
      p_actor_id: adminActor, p_email: email.toUpperCase()
    })
    expect(pending.error).toBeNull()
    for (const missingEmail of [null, '  ']) {
      const invalid = await service.rpc(role === 'none' ? 'account_admin_promote_maintainer' : 'account_admin_revoke_maintainer', {
        p_actor_id: adminActor, p_target_id: accountId, p_email: missingEmail
      })
      expect(invalid.error?.message).toMatch(/verified email required/)
      expect(roleFor(accountId)).toBe(role)
      expect(sql(`select status::text from public.account_pending_emails where id = '${pending.data}';`)).toBe('pending')
    }
    if (role === 'none') {
      const promote = await service.rpc('account_admin_promote_maintainer', {
        p_actor_id: adminActor, p_target_id: accountId, p_email: email
      })
      expect(promote.error).toBeNull()
      expect(sql(`select email from public.account_profiles where id = '${accountId}';`)).toBe(email)
    }
    const revoke = await service.rpc('account_admin_revoke_maintainer', {
      p_actor_id: adminActor, p_target_id: accountId, p_email: email
    })
    expect(revoke.error).toBeNull()
    expect(sql(`select email from public.account_profiles where id = '${accountId}';`)).toBe(email)
    expect(sql(`select status::text from public.account_pending_emails where id = '${pending.data}';`)).toBe(role === 'none' ? 'consumed' : 'cancelled')
    const nextSync = await sync(accountId, email)
    expect(nextSync.error).toBeNull()
    expect(nextSync.data).toBe('none')
    expect(roleFor(accountId)).toBe('none')
  })
})
