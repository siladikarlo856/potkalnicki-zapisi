import { beforeAll, describe, expect, it } from 'vitest'
import { integrationDb } from './support/integrationDb'

// Pending matching happens only inside account_sync_signed_in after verified-email checks in accountSync.ts.
const db = await integrationDb()
const { service, sql } = db

const accountId = '41000000-0000-4000-8000-000000000099'
const adminActor = '41000000-0000-4000-8000-000000000001'

async function sync(email: string) {
  return service.rpc('account_sync_signed_in', {
    p_account_id: accountId,
    p_email: email,
    p_bootstrap_email: null
  })
}

describe.skipIf(!db.enabled)('pending email match on sign-in', () => {
  beforeAll(() => {
    sql(`delete from public.account_role_audit where target_account_id in ('${accountId}', '${adminActor}') or target_email = 'match@pending-match.test';`)
    sql(`delete from public.account_pending_emails where email_normalized = 'match@pending-match.test';`)
    sql(`delete from public.account_profiles where id in ('${accountId}', '${adminActor}');`)
    sql(`insert into public.account_profiles (id, email, role) values ('${adminActor}', 'admin@pending-match.test', 'admin')
      on conflict (id) do update set email = excluded.email, role = excluded.role;`)
  })

  it('matches a verified sign-in email case-insensitively', async () => {
    const pending = await service.rpc('account_admin_preauthorize_maintainer', {
      p_actor_id: adminActor,
      p_email: 'MATCH@pending-match.test'
    })
    expect(pending.error).toBeNull()
    const result = await sync('match@pending-match.test')
    expect(result.error).toBeNull()
    expect(result.data).toBe('maintainer')
  })
})
