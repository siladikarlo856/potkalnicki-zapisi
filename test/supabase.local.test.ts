import { createClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

// Checks the Row Level Security in supabase/migrations against the real local Supabase stack.
// Skipped unless the stack is running and TEST_SUPABASE_* are set: run it with `pnpm test:local-db`.
const url = process.env.TEST_SUPABASE_URL ?? ''
const anonKey = process.env.TEST_SUPABASE_ANON_KEY ?? ''
const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? ''

const options = { auth: { persistSession: false, autoRefreshToken: false } }
const row = { text: 'rls check', type: 'word', place: null, name: null, contact: null, consent_publish: true, consent_version: '2026-10-26', locale: 'hr' }

describe.skipIf(!url)('heritage_submissions Row Level Security', () => {
  const anon = createClient(url || 'http://localhost', anonKey || 'anon', options)
  const admin = createClient(url || 'http://localhost', serviceRoleKey || 'service', options)
  let id = 0

  beforeAll(async () => {
    const { data, error } = await admin.from('heritage_submissions').insert(row).select('id').single()
    expect(error).toBeNull()
    id = data!.id
  })

  it('lets the anon key insert a submission, which starts as pending', async () => {
    const { error } = await anon.from('heritage_submissions').insert({ ...row, text: 'rls anon insert' })
    expect(error).toBeNull()
    const { data } = await admin.from('heritage_submissions').select('status, created_at, reviewed_at').eq('text', 'rls anon insert').limit(1).single()
    expect(data).toMatchObject({ status: 'pending', reviewed_at: null, created_at: expect.any(String) })
  })

  it('does not let the anon key read, update or delete anything', async () => {
    const read = await anon.from('heritage_submissions').select('*')
    expect(read.error).not.toBeNull()
    expect(read.data).toBeNull()

    await anon.from('heritage_submissions').update({ status: 'approved' }).eq('id', id)
    await anon.from('heritage_submissions').delete().eq('id', id)
    const { data } = await admin.from('heritage_submissions').select('status').eq('id', id).single()
    expect(data).toEqual({ status: 'pending' })
  })

  it('does not let the anon key choose status, review time or id', async () => {
    for (const extra of [{ status: 'approved' }, { reviewed_at: new Date().toISOString() }, { id: 999_999 }]) {
      const { error } = await anon.from('heritage_submissions').insert({ ...row, text: 'rls extra column', ...extra })
      expect(error).not.toBeNull()
    }
    const { data } = await admin.from('heritage_submissions').select('id').eq('text', 'rls extra column')
    expect(data).toEqual([])
  })

  it('does not accept a submission without consent or with bad values', async () => {
    for (const bad of [{ consent_publish: false }, { type: 'poem' }, { locale: 'de' }, { text: 'x' }, { text: 'x'.repeat(2001) }]) {
      const { error } = await anon.from('heritage_submissions').insert({ ...row, text: 'rls bad', ...bad })
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
