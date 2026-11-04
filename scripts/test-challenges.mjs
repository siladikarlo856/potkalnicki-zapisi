// Disposable Postgres + PostgREST; never starts, resets or migrates the shared Supabase stack.
import { execFileSync, spawn } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'

const root = fileURLToPath(new URL('..', import.meta.url))
const name = `ksh-challenge-test-${randomBytes(5).toString('hex')}`
const rest = `${name}-rest`
let proxy
const password = randomBytes(24).toString('hex')
const secret = randomBytes(32).toString('hex')
const docker = args => execFileSync('docker', args, { encoding: 'utf8' }).trim()
const sql = input => execFileSync('docker', ['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8' })
const jwt = (role) => {
  const body = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url')].join('.')
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}

try {
  docker(['run', '-d', '--name', name, '-e', `POSTGRES_PASSWORD=${password}`, '-p', '127.0.0.1::3000', 'postgres:18.6'])
  let ready = false
  for (let i = 0; i < 100; i++) {
    try {
      docker(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'])
      ready = true
      break
    } catch {
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }
  if (!ready) throw new Error('Isolated Postgres did not become ready')
  sql('create role anon; create role authenticated; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated, service_role; alter default privileges in schema public grant all on tables to service_role; alter default privileges in schema public grant all on sequences to service_role;')
  const migrations = new URL('../supabase/migrations/', import.meta.url)
  for (const file of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) sql(readFileSync(new URL(file, migrations), 'utf8'))
  docker(['run', '-d', '--name', rest, '--network', `container:${name}`, '-e', `PGRST_DB_URI=postgres://postgres:${password}@127.0.0.1:5432/postgres`, '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', `PGRST_JWT_SECRET=${secret}`, 'postgrest/postgrest:v16.5'])
  const port = docker(['port', name, '3000/tcp']).split(':').at(-1)
  const url = `http://127.0.0.1:${port}`
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) break
    } catch { /* container startup */ }
    if (i === 99) throw new Error('Isolated PostgREST did not become ready')
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  // Supabase-js uses /rest/v1; standalone PostgREST serves the same API at /.
  proxy = createServer(async (request, response) => {
    try {
      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      const headers = { ...request.headers }
      delete headers.host
      const upstream = await fetch(url + request.url.replace(/^\/rest\/v1/, ''), {
        method: request.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined
      })
      response.writeHead(upstream.status, Object.fromEntries(upstream.headers))
      response.end(Buffer.from(await upstream.arrayBuffer()))
    } catch { response.writeHead(502).end() }
  })
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve))
  const testFiles = process.argv.slice(2).length
    ? process.argv.slice(2)
    : [
        'test/challenge.integration.test.ts', 'test/dailyWord.integration.test.ts', 'test/content.integration.test.ts', 'test/contentSeed.integration.test.ts',
        'test/wordColumns.integration.test.ts', 'test/wordAreas.integration.test.ts', 'test/adminContent.integration.test.ts', 'test/adminAreas.integration.test.ts', 'test/adminHeritage.integration.test.ts', 'test/adminWords.integration.test.ts', 'test/contentHistory.integration.test.ts',
        'test/challengeTemplates.integration.test.ts', 'test/challengeSets.integration.test.ts', 'test/publicContent.integration.test.ts', 'test/atlasPages.integration.test.ts', 'test/contractRetire.integration.test.ts'
      ]
  const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--project=node', ...testFiles], {
    cwd: root, stdio: 'inherit', env: {
      ...process.env, TEST_CHALLENGE_API_URL: `http://127.0.0.1:${proxy.address().port}`, TEST_CHALLENGE_SERVICE_KEY: jwt('service_role'),
      TEST_CHALLENGE_PUBLIC_KEY: jwt('anon'), TEST_CHALLENGE_CONTAINER: name
    }
  })
  process.exitCode = await new Promise(resolve => child.on('exit', code => resolve(code ?? 1)))
} finally {
  proxy?.close()
  for (const container of [rest, name]) {
    try {
      docker(['rm', '-f', container])
    } catch { /* Only our disposable containers. */ }
  }
}
