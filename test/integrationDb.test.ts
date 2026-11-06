import { describe, expect, it } from 'vitest'

import { assertIsolatedDb, integrationDb, integrationEnv } from './support/integrationDb'

const isolated = { url: 'http://127.0.0.1:54321', container: 'ksh-challenge-test-0a1b2c3d4e' }

describe('integration database guard', () => {
  it('accepts the disposable container of scripts/test-challenges.mjs on loopback', () => {
    expect(() => assertIsolatedDb(isolated)).not.toThrow()
    expect(() => assertIsolatedDb({ ...isolated, url: 'http://localhost:3000' })).not.toThrow()
    expect(() => assertIsolatedDb({ ...isolated, url: 'http://[::1]:3000' })).not.toThrow()
  })

  it.each([
    ['the local Supabase stack', 'supabase_db_ksh'],
    ['no container', ''],
    ['a look-alike name', 'ksh-challenge-test-'],
    ['a suffixed name', 'ksh-challenge-test-abc; rm -rf /'],
    ['an upper-case id', 'ksh-challenge-test-ABC']
  ])('refuses %s', (_, container) => {
    expect(() => assertIsolatedDb({ ...isolated, container })).toThrow(/Refusing non-isolated database/)
  })

  it.each([
    ['a remote host', 'https://abcd.supabase.co'],
    ['a LAN host', 'http://192.168.1.10:54321'],
    ['a loopback look-alike', 'http://127.0.0.1.example.com'],
    ['no URL', '']
  ])('refuses %s', (_, url) => {
    expect(() => assertIsolatedDb({ ...isolated, url })).toThrow(/Refusing non-isolated database/)
  })

  it('refuses to start when the env points anywhere else', async () => {
    await expect(integrationDb({ env: { TEST_CHALLENGE_API_URL: 'https://abcd.supabase.co', TEST_CHALLENGE_CONTAINER: isolated.container } }))
      .rejects.toThrow(/Refusing non-isolated database/)
    await expect(integrationDb({ env: { TEST_CHALLENGE_API_URL: isolated.url, TEST_CHALLENGE_CONTAINER: 'supabase_db_ksh' } }))
      .rejects.toThrow(/Refusing non-isolated database/)
  })

  it('is disabled without the env, and its sql() still refuses to run', async () => {
    expect(integrationEnv({})).toBeNull()
    const db = await integrationDb({ env: {} })
    expect(db.enabled).toBe(false)
    expect(() => db.sql('select 1')).toThrow(/Refusing non-isolated database/)
    expect(() => db.failure('select 1')).toThrow(/Refusing non-isolated database/)
  })

  it('reads the env scripts/test-challenges.mjs sets', () => {
    expect(integrationEnv({
      TEST_CHALLENGE_API_URL: isolated.url, TEST_CHALLENGE_SERVICE_KEY: 'svc', TEST_CHALLENGE_PUBLIC_KEY: 'pub', TEST_CHALLENGE_CONTAINER: isolated.container
    })).toEqual({ url: isolated.url, serviceKey: 'svc', publicKey: 'pub', container: isolated.container })
  })
})
