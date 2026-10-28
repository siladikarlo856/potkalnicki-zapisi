// Helpers for the local Supabase stack. Used by the db:* scripts in package.json.
//   node scripts/local.mjs env     write the local API URL and secret key into .env
//   node scripts/local.mjs studio  open Supabase Studio in the browser
//   node scripts/local.mjs test    run the tests against the local stack (it must be running)
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const command = process.argv[2]

function status() {
  const output = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' })
  return Object.fromEntries(
    output.split('\n')
      .map(line => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter(Boolean)
      .map(match => [match[1], match[2]])
  )
}

if (command === 'env') {
  const values = status()
  const wanted = {
    NUXT_SUPABASE_URL: values.API_URL,
    NUXT_SUPABASE_SERVICE_ROLE_KEY: values.SECRET_KEY || values.SERVICE_ROLE_KEY
  }
  for (const [name, value] of Object.entries(wanted)) {
    if (!value) throw new Error(`supabase status did not print a value for ${name}`)
  }

  const file = new URL('../.env', import.meta.url)
  let lines = existsSync(file) ? readFileSync(file, 'utf8').split('\n') : []
  for (const [name, value] of Object.entries(wanted)) {
    const line = `${name}=${value}`
    const index = lines.findIndex(existing => existing.startsWith(`${name}=`))
    if (index === -1) lines.push(line)
    else lines[index] = line
  }
  writeFileSync(file, `${lines.join('\n').replace(/\n+$/, '')}\n`)
  console.log('Local Supabase URL and secret key written to .env')
} else if (command === 'studio') {
  const url = status().STUDIO_URL
  console.log(`Supabase Studio: ${url}`)
  const opener = { darwin: 'open', win32: 'start' }[process.platform] ?? 'xdg-open'
  try {
    execFileSync(opener, [url], { stdio: 'ignore', shell: process.platform === 'win32' })
  } catch {
    // The URL is printed above; opening a browser is only a convenience.
  }
} else if (command === 'test') {
  const values = status()
  try {
    execFileSync('pnpm', ['exec', 'vitest', 'run'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        TEST_SUPABASE_URL: values.API_URL,
        TEST_PUBLIC_KEY: values.PUBLISHABLE_KEY || values.ANON_KEY,
        TEST_SUPABASE_SERVICE_ROLE_KEY: values.SECRET_KEY || values.SERVICE_ROLE_KEY
      }
    })
  } catch {
    process.exit(1)
  }
} else {
  console.error('Usage: node scripts/local.mjs env|studio|test')
  process.exit(1)
}
