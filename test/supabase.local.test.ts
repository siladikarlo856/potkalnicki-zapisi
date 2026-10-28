import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Checks the Row Level Security in supabase/migrations against the real local Supabase stack.
// Skipped unless the stack is running and TEST_SUPABASE_* are set: run it with `pnpm test:local-db`.
const url = process.env.TEST_SUPABASE_URL ?? ''
const publicKey = process.env.TEST_PUBLIC_KEY ?? ''
const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? ''

const options = { auth: { persistSession: false, autoRefreshToken: false } }
const row = { text: 'rls check', type: 'word', place: null, name: null, contact: null, consent_publish: true, consent_version: '2026-10-26', locale: 'hr' }

describe.skipIf(!url)('heritage_submissions Row Level Security', () => {
  const anon = createClient(url || 'http://localhost', publicKey || 'public', options)
  const admin = createClient(url || 'http://localhost', serviceRoleKey || 'service', options)
  let id = 0

  beforeAll(async () => {
    const { data, error } = await admin.from('heritage_submissions').insert(row).select('id').single()
    expect(error).toBeNull()
    id = data!.id
  })

  afterAll(async () => {
    await admin.from('heritage_submissions').delete().eq('text', row.text)
    if (userId) await admin.auth.admin.deleteUser(userId)
  })

  let userId = ''
  it('denies all table access to both public and authenticated clients', async () => {
    const email = `rls-${Date.now()}@example.com`
    const password = 'local-test-password-0123456789'
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    expect(created.error).toBeNull()
    userId = created.data.user!.id
    const authenticated = createClient(url, publicKey, options)
    const signedIn = await authenticated.auth.signInWithPassword({ email, password })
    expect(signedIn.error).toBeNull()

    for (const client of [anon, authenticated]) {
      const insert = await client.from('heritage_submissions').insert({ ...row, text: 'rls public insert' })
      expect(insert.error).not.toBeNull()
      const read = await client.from('heritage_submissions').select('*')
      expect(read.error).not.toBeNull()
      expect(read.data).toBeNull()
      const update = await client.from('heritage_submissions').update({ status: 'approved' }).eq('id', id)
      expect(update.error).not.toBeNull()
      const remove = await client.from('heritage_submissions').delete().eq('id', id)
      expect(remove.error).not.toBeNull()
    }
    const { data } = await admin.from('heritage_submissions').select('status').eq('id', id).single()
    expect(data).toEqual({ status: 'pending' })
    const inserted = await admin.from('heritage_submissions').select('id').eq('text', 'rls public insert')
    expect(inserted.data).toEqual([])
  })

  it('keeps check constraints effective even for the secret key', async () => {
    for (const bad of [{ consent_publish: false }, { type: 'poem' }, { locale: 'de' }, { text: 'x' }, { text: 'x'.repeat(2001) }, { place: 'x'.repeat(121) }, { name: 'x'.repeat(101) }, { contact: 'x'.repeat(201) }, { consent_version: 'x'.repeat(21) }, { status: 'published' }]) {
      const { error } = await admin.from('heritage_submissions').insert({ ...row, text: 'rls bad', ...bad })
      expect(error).not.toBeNull()
    }
  })

  it('lets the service-role key list, approve, reject and delete', async () => {
    const approved = await admin.from('heritage_submissions').update({ status: 'approved' }).eq('id', id).select('id')
    expect(approved.data).toEqual([{ id }])
    const rejected = await admin.from('heritage_submissions').update({ status: 'rejected' }).eq('id', id).select('id')
    expect(rejected.data).toEqual([{ id }])
    const deleted = await admin.from('heritage_submissions').delete().eq('id', id).select('id')
    expect(deleted.data).toEqual([{ id }])
  })
})
