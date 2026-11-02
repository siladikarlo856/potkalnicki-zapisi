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
  const wordId = `rls-word-${Date.now()}`
  const wordRow = { id: wordId, entry: { id: wordId, headword: '', meaning: { hr: '' }, status: 'community', variants: [], sources: [] }, areas: [], active: false }

  beforeAll(async () => {
    const { data, error } = await admin.from('heritage_submissions').insert(row).select('id').single()
    expect(error).toBeNull()
    id = data!.id
    expect((await admin.from('heritage_words').insert({ ...wordRow, submission_id: id })).error).toBeNull()
  })

  afterAll(async () => {
    await admin.from('heritage_submissions').delete().eq('text', row.text)
    await admin.from('heritage_words').delete().eq('id', wordId)
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
      const wordInsert = await client.from('heritage_words').insert({ ...wordRow, id: `${wordId}-public` })
      expect(wordInsert.error).not.toBeNull()
      const wordRead = await client.from('heritage_words').select('*')
      expect(wordRead.error).not.toBeNull()
      expect(wordRead.data).toBeNull()
      const wordUpdate = await client.from('heritage_words').update({ active: true }).eq('id', wordId)
      expect(wordUpdate.error).not.toBeNull()
      const wordRemove = await client.from('heritage_words').delete().eq('id', wordId)
      expect(wordRemove.error).not.toBeNull()
    }
    const { data } = await admin.from('heritage_submissions').select('status').eq('id', id).single()
    expect(data).toEqual({ status: 'pending' })
    const inserted = await admin.from('heritage_submissions').select('id').eq('text', 'rls public insert')
    expect(inserted.data).toEqual([])
  })

  it('keeps check constraints effective even for the secret key', async () => {
    expect((await admin.from('heritage_words').update({ active: true }).eq('id', wordId)).error).not.toBeNull()
    // The BEFORE trigger tried to approve the linked submission, but the failed word
    // constraint must roll that side effect back in the same transaction.
    const submission = await admin.from('heritage_submissions').select('status').eq('id', id).single()
    expect(submission.data).toEqual({ status: 'pending' })
    expect((await admin.from('heritage_words').update({ entry: { id: wordId } }).eq('id', wordId)).error).not.toBeNull()
    for (const bad of [{ consent_publish: false }, { type: 'poem' }, { locale: 'de' }, { text: 'x' }, { text: 'x'.repeat(2001) }, { place: 'x'.repeat(121) }, { name: 'x'.repeat(101) }, { contact: 'x'.repeat(201) }, { consent_version: 'x'.repeat(21) }, { status: 'published' }]) {
      const { error } = await admin.from('heritage_submissions').insert({ ...row, text: 'rls bad', ...bad })
      expect(error).not.toBeNull()
    }
  })

  it('seeds the reviewed word list with UUID ids and none of the old text ids', async () => {
    const { data, error } = await admin.from('heritage_words').select('id,entry,active,submission_id').is('submission_id', null)
    expect(error).toBeNull()
    const seeded = data!.filter(row => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(row.id))
    expect(seeded.filter(row => row.active)).toHaveLength(51)
    expect(seeded.filter(row => !row.active)).toHaveLength(10)
    for (const row of seeded) {
      expect(row.entry.id).toBe(row.id)
      expect(row.entry.status).toBe(row.active ? 'verified' : 'placeholder')
    }
    const old = await admin.from('heritage_words').select('id').in('id', ['hiza', 'kaj', 'vura', 'zdenec', 'fertun', 'lajbek', 'skrlak', 'cuker', 'denes', 'babica'])
    expect(old.data).toEqual([])
  })

  it('keeps the word link on submissions closed to public roles and constrained for the secret key', async () => {
    const linkedText = `rls linked ${Date.now()}`
    const linked = { ...row, text: linkedText, type: 'word', place_id: null, word_id: wordId, intent: 'usage' }
    const email = `rls-link-${Date.now()}@example.com`
    const password = 'local-test-password-0123456789'
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    expect(created.error).toBeNull()
    const authenticated = createClient(url, publicKey, options)
    expect((await authenticated.auth.signInWithPassword({ email, password })).error).toBeNull()

    for (const client of [anon, authenticated]) {
      expect((await client.from('heritage_submissions').insert(linked)).error).not.toBeNull()
      const read = await client.from('heritage_submissions').select('word_id,intent')
      expect(read.error).not.toBeNull()
      expect(read.data).toBeNull()
      expect((await client.from('heritage_submissions').update({ word_id: wordId, intent: 'usage' }).eq('id', id)).error).not.toBeNull()
    }
    await admin.auth.admin.deleteUser(created.data.user!.id)

    // The secret key bypasses RLS but not the check constraints: an intent needs a word, and only two intents exist.
    expect((await admin.from('heritage_submissions').insert({ ...linked, word_id: null })).error).not.toBeNull()
    expect((await admin.from('heritage_submissions').insert({ ...linked, intent: 'confirm' })).error).not.toBeNull()
    expect((await admin.from('heritage_submissions').insert({ ...linked, word_id: 'no-such-word' })).error).not.toBeNull()
    const stored = await admin.from('heritage_submissions').insert(linked).select('id,word_id,intent').single()
    expect(stored.error).toBeNull()
    expect(stored.data).toMatchObject({ word_id: wordId, intent: 'usage' })
    const unlinked = await admin.from('heritage_submissions').insert({ ...row, text: `${linkedText} unlinked` }).select('word_id,intent').single()
    expect(unlinked.data).toEqual({ word_id: null, intent: null })

    // Deleting a usage confirmation must never deactivate the word it points at.
    const wordBefore = await admin.from('heritage_words').select('active').eq('id', wordId).single()
    expect((await admin.from('heritage_submissions').delete().eq('id', stored.data!.id)).error).toBeNull()
    expect((await admin.from('heritage_words').select('active').eq('id', wordId).single()).data).toEqual(wordBefore.data)
    await admin.from('heritage_submissions').delete().like('text', `${linkedText}%`)
  })

  it('deactivates the linked word when its submission is rejected or deleted, and removes the credit', async () => {
    const make = async (suffix: string) => {
      const sub = await admin.from('heritage_submissions').insert({ ...row, text: `rls withdraw ${suffix}`, name: 'Ana' }).select('id').single()
      expect(sub.error).toBeNull()
      const wid = `${wordId}-${suffix}`
      const entry = { id: wid, headword: 'x', meaning: { hr: 'y' }, partOfSpeech: 'imenica', status: 'community', variants: [{ id: `${wid}~x`, form: 'x', status: 'community', usages: [] }], sources: [{ id: 's1', kind: 'contribution', credit: 'Ana' }] }
      expect((await admin.from('heritage_words').insert({ id: wid, entry, areas: [], active: true, submission_id: sub.data!.id })).error).toBeNull()
      return { sid: sub.data!.id as number, wid }
    }
    const rejectCase = await make('reject')
    expect((await admin.from('heritage_submissions').select('status').eq('id', rejectCase.sid).single()).data).toEqual({ status: 'approved' })
    expect((await admin.from('heritage_submissions').update({ status: 'rejected' }).eq('id', rejectCase.sid)).error).toBeNull()
    expect((await admin.from('heritage_words').select('active').eq('id', rejectCase.wid).single()).data).toEqual({ active: false })

    const deleteCase = await make('delete')
    expect((await admin.from('heritage_submissions').delete().eq('id', deleteCase.sid)).error).toBeNull()
    const word = await admin.from('heritage_words').select('active,submission_id,entry').eq('id', deleteCase.wid).single()
    expect(word.data).toMatchObject({ active: false, submission_id: null })
    expect(word.data!.entry.sources).toEqual([{ id: 's1', kind: 'contribution' }])

    await admin.from('heritage_submissions').delete().eq('id', rejectCase.sid)
    await admin.from('heritage_words').delete().in('id', [rejectCase.wid, deleteCase.wid])
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
