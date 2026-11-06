// The harness of every test/*.integration.test.ts: the env that `node scripts/test-challenges.mjs` sets, the guard
// that keeps them off any database but its disposable one, psql access to that database, Supabase clients and the
// file's Nuxt server (started from the shared build, test/support/nuxtServer.ts).
//
//   const db = await integrationDb({ server: { NUXT_REVIEW_SECRET: SECRET } })
//   describe.skipIf(!db.enabled)('…', () => { it('…', async () => { db.sql('select 1'); await db.fetch('/api/…') }) })
import { execFileSync } from 'node:child_process'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fetch } from '@nuxt/test-utils/e2e'

import { setupNuxtServer } from './nuxtServer'

export interface IntegrationEnv {
  /** PostgREST behind a /rest/v1 proxy, as supabase-js expects. */
  url: string
  serviceKey: string
  publicKey: string
  /** The disposable Postgres container that psql runs in. */
  container: string
}

type Env = Record<string, string | undefined>

/** The integration env, or null when it is not set (the tests are then skipped). */
export function integrationEnv(env: Env = process.env): IntegrationEnv | null {
  const url = env.TEST_CHALLENGE_API_URL
  if (!url) return null
  return {
    url,
    serviceKey: env.TEST_CHALLENGE_SERVICE_KEY ?? '',
    publicKey: env.TEST_CHALLENGE_PUBLIC_KEY ?? '',
    container: env.TEST_CHALLENGE_CONTAINER ?? ''
  }
}

// scripts/test-challenges.mjs names its container ksh-challenge-test-<hex> and serves the API on loopback.
const ISOLATED_CONTAINER = /^ksh-challenge-test-[a-f0-9]+$/
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

/**
 * The isolation guard: throws unless the env points at a disposable test database. The tests insert, update and
 * delete rows freely, so they must never reach a shared or production one.
 */
export function assertIsolatedDb(env: Pick<IntegrationEnv, 'url' | 'container'>) {
  if (!ISOLATED_CONTAINER.test(env.container)) {
    throw new Error(`Refusing non-isolated database: container "${env.container}" is not a disposable ksh-challenge-test-* container (run node scripts/test-challenges.mjs)`)
  }
  let host = ''
  try {
    host = new URL(env.url).hostname
  } catch { /* not a URL: refused below */ }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Refusing non-isolated database: API URL "${env.url}" is not on loopback (run node scripts/test-challenges.mjs)`)
  }
}

export interface IntegrationDbOptions {
  /**
   * Start this file's Nuxt server against the test database. NUXT_SUPABASE_URL and NUXT_SUPABASE_SERVICE_ROLE_KEY
   * are set; pass any further runtime env (e.g. NUXT_REVIEW_SECRET), or `{}` for none.
   */
  server?: Record<string, string>
  /** Where to read the env from; process.env by default. */
  env?: Env
}

export interface IntegrationDb extends IntegrationEnv {
  /** Whether the integration env is set; use as `describe.skipIf(!db.enabled)`. */
  enabled: boolean
  /** Runs SQL as postgres through psql (unaligned, tuples only, quiet) and returns its trimmed output. */
  sql: (input: string) => string
  /** The psql error output of SQL that must fail; throws if it succeeds. */
  failure: (input: string) => string
  /** A fresh supabase-js client with the service role key, or the public (anon) key. */
  client: (role?: 'service' | 'anon') => SupabaseClient
  /** One shared service-role client. */
  readonly service: SupabaseClient
  /** Fetch from this file's Nuxt server (needs the `server` option). */
  fetch: typeof fetch
}

/**
 * The integration harness for one test file. Call it once at the top level, awaited, before any `describe`.
 * When the env is set it refuses to run against anything but the disposable test database.
 */
export async function integrationDb(options: IntegrationDbOptions = {}): Promise<IntegrationDb> {
  const env = integrationEnv(options.env)
  if (env) assertIsolatedDb(env)
  const { url, serviceKey, publicKey, container } = env ?? { url: '', serviceKey: '', publicKey: '', container: '' }

  if (env && options.server) {
    await setupNuxtServer({ NUXT_SUPABASE_URL: url, NUXT_SUPABASE_SERVICE_ROLE_KEY: serviceKey, ...options.server })
  }

  function sql(input: string) {
    assertIsolatedDb({ url, container })
    return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'], {
      input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
    }).trim()
  }

  function failure(input: string) {
    try {
      sql(input)
    } catch (error) {
      const stderr = (error as { stderr?: unknown }).stderr
      if (typeof stderr !== 'string') throw error // the guard, or docker itself, not the statement
      return stderr || String(error)
    }
    throw new Error(`Expected the statement to fail: ${input}`)
  }

  const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } }
  const client = (role: 'service' | 'anon' = 'service') =>
    createClient(url || 'http://localhost', (role === 'service' ? serviceKey : publicKey) || role, clientOptions)
  let service: SupabaseClient | undefined

  return {
    enabled: env !== null, url, serviceKey, publicKey, container, sql, failure, client, fetch,
    get service() {
      return service ??= client('service')
    }
  }
}
