import { beforeAll, describe, expect, it } from 'vitest'
import { integrationDb } from './support/integrationDb'

const db = await integrationDb()
const { sql, service, failure } = db

const bootstrapTarget = '30000000-0000-4000-8000-000000000001'
const otherAccount = '30000000-0000-4000-8000-000000000002'
const secondMatch = '30000000-0000-4000-8000-000000000003'
const fixtureIds = [bootstrapTarget, otherAccount, secondMatch].map(id => `'${id}'`).join(', ')

async function sync(
  accountId: string,
  email: string,
  bootstrap: string | null
) {
  return service.rpc('account_sync_signed_in', {
    p_account_id: accountId,
    p_email: email,
    p_bootstrap_email: bootstrap
  })
}

function auditBootstrapCount() {
  return Number(sql(`select count(*) from public.account_role_audit where action = 'bootstrap_admin' and target_account_id in (${fixtureIds});`))
}

function roleFor(accountId: string) {
  return sql(`select role::text from public.account_profiles where id = '${accountId}';`)
}

describe.skipIf(!db.enabled)('one-time admin bootstrap on verified sign-in', () => {
  beforeAll(() => {
    sql(`delete from public.account_role_audit where action = 'bootstrap_admin' and target_account_id in (${fixtureIds});`)
    sql(`delete from public.account_profiles where id in (${fixtureIds});`)
  })

  it('refuses unverified-style empty email at the database boundary', () => {
    expect(failure(`select public.account_sync_signed_in('${otherAccount}', '  ', 'admin@example.com');`))
      .toMatch(/verified email required/)
  })

  it('grants exactly one admin role and audit row for a matching bootstrap email', async () => {
    const first = await sync(bootstrapTarget, 'Admin@Example.COM', 'admin@example.com')
    expect(first.error).toBeNull()
    expect(first.data).toBe('admin')
    expect(roleFor(bootstrapTarget)).toBe('admin')
    expect(auditBootstrapCount()).toBe(1)
  })

  it('keeps a non-matching verified account role-less', async () => {
    const result = await sync(otherAccount, 'other@example.com', 'admin@example.com')
    expect(result.error).toBeNull()
    expect(result.data).toBe('none')
    expect(roleFor(otherAccount)).toBe('none')
    expect(auditBootstrapCount()).toBe(1)
  })

  it('grants nothing when the bootstrap email is absent', async () => {
    sql(`delete from public.account_profiles where id = '${otherAccount}';`)
    const result = await sync(otherAccount, 'admin@example.com', null)
    expect(result.error).toBeNull()
    expect(result.data).toBe('none')
    expect(roleFor(otherAccount)).toBe('none')
    expect(auditBootstrapCount()).toBe(1)
  })

  it('does not create a second admin after bootstrap or on repeat sign-in', async () => {
    const repeat = await sync(bootstrapTarget, 'admin@example.com', 'admin@example.com')
    expect(repeat.error).toBeNull()
    expect(repeat.data).toBe('admin')
    expect(auditBootstrapCount()).toBe(1)

    const changedEnv = await sync(secondMatch, 'another-admin@example.com', 'another-admin@example.com')
    expect(changedEnv.error).toBeNull()
    expect(changedEnv.data).toBe('none')
    expect(roleFor(secondMatch)).toBe('none')
    expect(auditBootstrapCount()).toBe(1)
    expect(sql(`select count(*) from public.account_profiles where role = 'admin' and id in (${fixtureIds});`)).toBe('1')
  })
})
