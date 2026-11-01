import { fileURLToPath } from 'node:url'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { fetch, getServerLogs, setup, startServer, useTestContext } from '@nuxt/test-utils/e2e'
import { SERVICE_ROLE_KEY, startFakeSupabase } from './helpers/fakeSupabase'
import { createClient } from '@supabase/supabase-js'
import type { AdminWord, PublicWords, WordInput } from '../shared/utils/word'
import atlasPrerenderRoutes from '../content/atlas/prerender-routes.json'
import { getAtlas, settlementByCode } from '../shared/utils/atlasData'

const SECRET = 'test-review-secret-0123456789'
const SESSION_PASSWORD = 'test-admin-session-password-0123456789'
const RATE_LIMIT_MAX = 3

// By default the app talks to a small fake of Supabase's REST API (test/helpers/fakeSupabase.ts),
// so this suite needs no Docker. To run it against the real local stack instead (after
// `pnpm db:up`), set TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_ROLE_KEY,
// which is what `pnpm test:local-db` does.
const real = process.env.TEST_SUPABASE_URL
  ? {
      url: process.env.TEST_SUPABASE_URL,
      serviceRoleKey: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? ''
    }
  : null
const fake = real ? null : await startFakeSupabase()
const supabase = real ?? { url: fake!.url, serviceRoleKey: SERVICE_ROLE_KEY }

afterAll(() => fake?.stop())

await setup({
  rootDir: fileURLToPath(new URL('..', import.meta.url)),
  server: true,
  setupTimeout: 300_000,
  env: {
    NUXT_SUPABASE_URL: supabase.url,
    NUXT_SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
    NUXT_REVIEW_SECRET: SECRET,
    NUXT_ADMIN_SESSION_PASSWORD: SESSION_PASSWORD,
    NUXT_SUBMISSION_RATE_LIMIT_MAX: String(RATE_LIMIT_MAX)
  }
})

let ipCounter = 0
// Each test gets its own client address so the per-IP limits don't leak between tests.
function newClient() {
  ipCounter++
  return `203.0.113.${ipCounter}`
}

function request(path: string, init: { method?: string, body?: unknown, secret?: string, ip?: string, headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'x-forwarded-for': init.ip ?? newClient(), ...init.headers }
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  if (init.secret !== undefined) headers.authorization = `Bearer ${init.secret}`
  return fetch(path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  })
}

function submit(body: Record<string, unknown>, ip?: string) {
  return request('/api/submissions', { method: 'POST', body, ip })
}

async function listAll() {
  const response = await request('/api/review/submissions?status=all', { secret: SECRET })
  expect(response.status).toBe(200)
  return await response.json() as Array<Record<string, unknown>>
}

const valid = { text: 'Kaj to znači?', type: 'expression', placeId: 'geonames:3194024', name: 'Ana', contact: 'ana@example.com', consentPublish: true, locale: 'hr' }

const db = createClient(supabase.url, supabase.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
const wordIds: string[] = []
afterAll(async () => {
  for (const id of wordIds) await db.from('heritage_words').delete().eq('id', id)
})

function wordInput(active = false): WordInput {
  return {
    entry: {
      id: 'client-id-is-ignored', headword: 'testna riječ', meaning: { hr: 'testno značenje', en: 'test meaning' }, partOfSpeech: 'imenica',
      status: 'community', sources: [{ id: 'editor', kind: 'editor', credit: 'Local test' }],
      examples: [{ text: 'Primjer riječi.', translation: 'Example.' }],
      variants: [{ id: 'test-variant', form: 'testna riječ', status: 'community', usages: [{ areaId: 'test-area', confidence: 'reported', sourceId: 'editor' }] }]
    },
    areas: [{ id: 'test-area', name: 'Testno područje', kind: 'settlement', parentId: null }], active
  }
}

async function createWord(body: unknown = wordInput()) {
  const response = await request('/api/review/words', { method: 'POST', secret: SECRET, body })
  expect(response.status).toBe(201)
  const word = await response.json() as AdminWord
  wordIds.push(word.entry.id)
  return word
}
async function readPublic(limit?: number) {
  const response = await request(`/api/heritage/words${limit ? `?limit=${limit}` : ''}`)
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toContain('max-age=30')
  return await response.json() as PublicWords
}

describe('Potkalnički zapisi learning and challenge choice', () => {
  it('serves the separate learning and challenge destinations on the games hub', async () => {
    const response = await request('/potkalnicko-prigorje/igre')
    expect(response.status).toBe(200)
    const html = await response.text()
    const { Window } = await import('happy-dom')
    const window = new Window()
    window.document.body.innerHTML = html
    const catalog = window.document.querySelector('[data-testid="quiz-catalog"]')!
    expect(catalog).not.toBeNull()
    expect(catalog.querySelector('[data-testid="friend-challenge-hero"]')?.textContent).toContain('Izazovi prijatelja')
    const choice = window.document.querySelector('[data-testid="heritage-mode-choice"]')!
    expect(choice).not.toBeNull()
    expect([...choice.querySelectorAll('h2')].map(h => h.textContent)).toEqual(['Uči', 'Izazov'])
    expect([...choice.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual([
      '/potkalnicko-prigorje/igre/kartice', '/potkalnicko-prigorje/igre/kviz'
    ])
    expect(choice.textContent).toContain('Počni učiti')
    const challengeChoice = choice.querySelector('[data-testid="challenge-mode-choice"]')!
    expect(challengeChoice).not.toBeNull()
    expect(challengeChoice.querySelector('a[href="/potkalnicko-prigorje/igre/kviz"]')?.textContent).toContain('Brzi izazov')
    expect(challengeChoice.textContent).toContain('Prilagođeni izazov')
    expect(challengeChoice.querySelector('button[disabled]')?.textContent).toContain('Uskoro')
    expect(window.document.querySelector('header')?.textContent).toContain('Igre')
    expect(window.document.querySelector('header')?.textContent).toContain('Doprinesi')
    expect(window.document.querySelector('header')?.textContent).toContain('O projektu')
    expect(window.document.querySelector('header')?.textContent).not.toContain('Karlo Siladi')
    await window.happyDOM.close()
  })

  it('keeps the deliberate learning-to-challenge jump on the cards page', async () => {
    const response = await request('/potkalnicko-prigorje/igre/kartice')
    expect(response.status).toBe(200)
    const html = await response.text()
    const { Window } = await import('happy-dom')
    const window = new Window()
    window.document.body.innerHTML = html
    const challengeLink = [...window.document.querySelectorAll('a')]
      .find(link => link.getAttribute('href') === '/potkalnicko-prigorje/igre/kviz')
    expect(challengeLink?.textContent).toContain('Isprobaj izazov')
    await window.happyDOM.close()
  })
})

describe('Potkalnički zapisi app home', () => {
  it('renders the phase 2 hero, regions teaser and contribute band', async () => {
    const response = await request('/potkalnicko-prigorje')
    expect(response.status).toBe(200)
    const html = await response.text()
    const { Window } = await import('happy-dom')
    const window = new Window()
    window.document.body.innerHTML = html
    expect(window.document.body.textContent).toContain('Otkrij priče koje čine Potkalničko prigorje.')
    expect(html).toContain('Igraj s riječima')
    expect(html).toContain('/potkalnicko-prigorje/igre')
    expect(window.document.querySelector('#doprinos')).not.toBeNull()
    expect(window.document.querySelector('a[href="/potkalnicko-prigorje/doprinesi"]')).not.toBeNull()
    expect(window.document.querySelector('[data-testid="pet-podrucja"]')?.textContent).toContain('Grad Križevci')
    expect(window.document.querySelector('[data-testid="pet-podrucja"]')?.textContent).toContain('60 naselja · 34 zapisa')
    expect(window.document.querySelector('[data-testid="quiz-catalog"]')).toBeNull()
    expect(window.document.querySelector('#doprinos form')).toBeNull()
    expect(html).not.toContain('i-lucide-construction')
    await window.happyDOM.close()
  })
})

describe('Potkalnički zapisi contribute and about pages', () => {
  it('renders the contribution type picker', async () => {
    const picker = await request('/potkalnicko-prigorje/doprinesi')
    expect(picker.status).toBe(200)
    const pickerHtml = await picker.text()
    const { Window } = await import('happy-dom')
    const pickerWindow = new Window()
    pickerWindow.document.body.innerHTML = pickerHtml
    expect(pickerWindow.document.querySelector('[data-testid="contribute-type-picker"]')).not.toBeNull()
    expect(pickerHtml).toContain('Pošalji riječ ili izraz')
    expect(pickerHtml).toContain('Predloži ispravak')
    expect(pickerHtml).not.toContain('faza 3')
    await pickerWindow.happyDOM.close()
  })

  it('documents the author on O projektu without a portfolio link', async () => {
    const response = await request('/potkalnicko-prigorje/o-projektu')
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('Karlo Siladi')
    expect(html).toContain('id="izvori"')
    expect(html).not.toMatch(/href="\/"/)
  })
})

describe('Potkalnički zapisi quiz catalog', () => {
  it('renders the Croatian catalog with Croatian topic slugs', async () => {
    const response = await request('/potkalnicko-prigorje/igre')
    expect(response.status).toBe(200)
    const html = await response.text()
    const { Window } = await import('happy-dom')
    const window = new Window()
    window.document.body.innerHTML = html
    const catalog = window.document.querySelector('[data-testid="quiz-catalog"]')!
    expect(catalog).not.toBeNull()
    expect(catalog.querySelector('[data-testid="quiz-hero"] h2')?.textContent).toBe('Riječi')
    expect(catalog.querySelector('[data-testid="quiz-hero"] a')?.getAttribute('href')).toBe('/potkalnicko-prigorje/igre/kviz')
    expect(catalog.querySelector('[data-testid="quiz-hero"]')?.textContent).toContain('Igraj s riječima')
    const churchCard = catalog.querySelector('[data-testid="topic-card-crkve"]')!
    expect(churchCard).not.toBeNull()
    const churchLink = churchCard.matches('a') ? churchCard : churchCard.querySelector('a')
    expect(churchLink?.getAttribute('href')).toBe('/potkalnicko-prigorje/igre/crkve')
    expect(catalog.textContent).toContain('Crkve')

    const topicResponse = await request('/potkalnicko-prigorje/igre/crkve')
    expect(topicResponse.status).toBe(200)
    const topicHtml = await topicResponse.text()
    const topicWindow = new Window()
    topicWindow.document.body.innerHTML = topicHtml
    const quizList = topicWindow.document.querySelector('[data-testid="topic-quiz-list"]')!
    expect(quizList).not.toBeNull()
    expect(quizList.textContent).toContain('Spajanje')
    expect(quizList.querySelector('button[disabled]')).not.toBeNull()
    await window.happyDOM.close()
    await topicWindow.happyDOM.close()
  })
})

describe('word admin and public word APIs', () => {
  it('renders loading copy for client-fetched cards in both prerendered pages', async () => {
    for (const path of ['/', '/potkalnicko-prigorje/igre/kartice']) {
      const response = await request(path)
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('Učitavam kartice…')
    }
  })

  it.each([
    { method: 'GET', path: '/api/review/words' },
    { method: 'POST', path: '/api/review/words', body: wordInput() },
    { method: 'PUT', path: '/api/review/words/anything', body: wordInput() },
    { method: 'POST', path: '/api/review/submissions/1/word' }
  ])('$method $path rejects unauthenticated access before doing any work', async ({ method, path, body }) => {
    expect((await request(path, { method, body })).status).toBe(401)
    expect((await request(path, { method, body, secret: 'wrong' })).status).toBe(401)
  })

  it('creates, edits, activates and deactivates, preserving all WordEntry parameters', async () => {
    const word = await createWord()
    expect(word.entry.id).not.toBe('client-id-is-ignored')
    expect(word).toMatchObject({ active: false, submissionId: null, createdAt: expect.any(String), updatedAt: expect.any(String) })
    expect((await readPublic()).words.some(w => w.id === word.entry.id)).toBe(false)
    const path = `/api/review/words/${word.entry.id}`
    expect((await request(path, { method: 'PUT', secret: SECRET, body: { ...word, active: true, entry: { ...word.entry, meaning: { hr: 'novo značenje' } } } })).status).toBe(200)
    const published = (await readPublic()).words.find(w => w.id === word.entry.id)
    expect(published).toMatchObject({ meaning: { hr: 'novo značenje' }, examples: word.entry.examples, variants: word.entry.variants, sources: word.entry.sources })
    expect((await request(path, { method: 'PUT', secret: SECRET, body: { ...word, active: false } })).status).toBe(200)
    expect((await readPublic()).words.some(w => w.id === word.entry.id)).toBe(false)
    const list = await (await request('/api/review/words', { secret: SECRET })).json() as AdminWord[]
    expect(list.find(w => w.entry.id === word.entry.id)?.active).toBe(false)
  })

  it('promotes a submission once into a linked inactive draft without approving or publishing it', async () => {
    await submit({ ...valid, text: 'promotion test word', type: 'word' })
    const submission = (await listAll()).find(s => s.text === 'promotion test word')!
    const path = `/api/review/submissions/${submission.id}/word`
    const promoted = await request(path, { method: 'POST', secret: SECRET })
    expect(promoted.status).toBe(201)
    const word = await promoted.json() as AdminWord
    wordIds.push(word.entry.id)
    expect(word).toMatchObject({ active: false, submissionId: submission.id, submissionPlace: 'Sveti Petar Orehovec (geonames:3194024)', entry: { headword: 'promotion test word', meaning: { hr: '' }, status: 'community', sources: [{ kind: 'contribution', credit: 'Ana' }] } })
    expect(word.entry.variants[0]?.usages).toMatchObject([{ areaId: 'hr-kkz-sveti-petar-orehovec', confidence: 'reported' }])
    expect(JSON.stringify(word)).not.toContain(valid.contact)
    const repeat = await (await request(path, { method: 'POST', secret: SECRET })).json() as AdminWord
    expect(repeat.entry.id).toBe(word.entry.id)
    expect((await listAll()).find(s => s.id === submission.id)?.status).toBe('pending')
    expect((await readPublic()).words.some(w => w.id === word.entry.id)).toBe(false)
    expect((await request(`/api/review/words/${word.entry.id}`, { method: 'PUT', secret: SECRET, body: { ...word, active: true } })).status).toBe(400)
    expect((await listAll()).find(s => s.id === submission.id)?.status).toBe('pending')
    const completed = { ...word, active: true, entry: { ...word.entry, meaning: { hr: 'dovršeno značenje' }, partOfSpeech: 'imenica' } }
    expect((await request(`/api/review/words/${word.entry.id}`, { method: 'PUT', secret: SECRET, body: completed })).status).toBe(200)
    expect((await listAll()).find(s => s.id === submission.id)).toMatchObject({ status: 'approved', reviewedAt: expect.any(String) })
    expect((await readPublic()).words.find(w => w.id === word.entry.id)?.headword).toBe('promotion test word')
  })

  it('retains an unmapped canonical place as a private note without guessing a sample area', async () => {
    expect((await submit({ ...valid, text: 'unmapped catalog promotion', placeId: 'geonames:3194545' })).status).toBe(201)
    const submission = (await listAll()).find(s => s.text === 'unmapped catalog promotion')!
    const response = await request(`/api/review/submissions/${submission.id}/word`, { method: 'POST', secret: SECRET })
    expect(response.status).toBe(201)
    const word = await response.json() as AdminWord
    wordIds.push(word.entry.id)
    expect(word.submissionPlace).toBe('Nemčevec (geonames:3194545)')
    expect(word.entry.variants[0]?.usages).toEqual([])
    expect(word.active).toBe(false)
  })

  it('publishes an active word whose variants have no places, without storing any region usage', async () => {
    const input = wordInput(true)
    input.entry.variants[0]!.usages = []
    const word = await createWord(input)
    const published = (await readPublic()).words.find(w => w.id === word.entry.id)
    expect(published?.variants[0]?.usages).toEqual([])
  })

  it('uses memories as examples and never invents a contributor credit', async () => {
    await submit({ ...valid, text: 'promotion memory test', type: 'memory', name: '', placeId: null })
    const submission = (await listAll()).find(s => s.text === 'promotion memory test')!
    const response = await request(`/api/review/submissions/${submission.id}/word`, { method: 'POST', secret: SECRET })
    const word = await response.json() as AdminWord
    wordIds.push(word.entry.id)
    expect(word.entry.headword).toBe('')
    expect(word.entry.examples).toEqual([{ text: 'promotion memory test' }])
    expect(word.entry.sources[0]).not.toHaveProperty('credit')
    expect(word.submissionPlace).toBeNull()
    expect(word.active).toBe(false)
  })

  it('only returns active words and whitelisted public fields, even after a direct database write', async () => {
    const word = await createWord(wordInput(true))
    const rawEntry = { ...word.entry, contact: 'private@example.com', submissionId: 42, privateNote: 'secret', meaning: { ...word.entry.meaning, private: 'secret' }, sources: [{ ...word.entry.sources[0], contact: 'hidden' }] }
    const { error } = await db.from('heritage_words').update({ entry: rawEntry, submission_place: 'private place' }).eq('id', word.entry.id)
    expect(error).toBeNull()
    const result = await readPublic()
    const publicWord = result.words.find(w => w.id === word.entry.id)!
    expect(publicWord).toBeDefined()
    expect(publicWord).not.toHaveProperty('active')
    expect(publicWord).not.toHaveProperty('submissionId')
    expect(publicWord).not.toHaveProperty('contact')
    expect(publicWord).not.toHaveProperty('privateNote')
    expect(publicWord.meaning).not.toHaveProperty('private')
    expect(publicWord.sources[0]).not.toHaveProperty('contact')
    expect(result).not.toHaveProperty('submissionPlace')
    expect((await readPublic(1)).words.length).toBeLessThanOrEqual(1)
  })

  it('validates required active fields, nested types, references, lengths, and bounded queries', async () => {
    const good = wordInput(true)
    const invalid = [
      {}, { ...good, active: 'true' },
      ...[{ headword: '' }, { headword: 'x'.repeat(201) }, { meaning: { hr: '' } }, { partOfSpeech: '' }, { sources: [] }, { variants: [] }, { status: 'published' }, { examples: [{ text: 42 }] }, { variants: [{ ...good.entry.variants[0], usages: [{ areaId: 'unknown', confidence: 'reported' }] }] }].map(entry => ({ ...good, entry: { ...good.entry, ...entry } })),
      { ...good, areas: [{ id: 'test-area', name: 'bad', kind: 'settlement', parentId: 'test-area' }] },
      { ...good, entry: { ...good.entry, tags: Array.from({ length: 21 }, () => 'tag') } }
    ]
    for (const body of invalid) expect((await request('/api/review/words', { method: 'POST', body, secret: SECRET })).status).toBe(400)
    expect((await request('/api/review/words', { method: 'POST', body: { ...good, extra: 'x'.repeat(140000) }, secret: SECRET })).status).toBe(413)
    for (const limit of ['0', '101', '1.5', 'nope']) expect((await request(`/api/heritage/words?limit=${limit}`)).status).toBe(400)
    expect((await request('/api/review/words?offset=-1', { secret: SECRET })).status).toBe(400)
    expect((await request('/api/review/words/missing', { method: 'PUT', secret: SECRET, body: good })).status).toBe(404)
    expect((await request('/api/review/submissions/999999999/word', { method: 'POST', secret: SECRET })).status).toBe(404)
  })
})

describe('admin session', () => {
  it('rejects a wrong password and rate limits the eleventh failure', async () => {
    const ip = newClient()
    for (let attempt = 0; attempt < 10; attempt++) {
      expect((await request('/api/admin/session', { method: 'POST', body: { password: 'wrong-password' }, ip })).status).toBe(401)
    }
    expect((await request('/api/admin/session', { method: 'POST', body: { password: 'wrong-password' }, ip })).status).toBe(429)
  })

  it('sets a sealed cookie, authenticates review APIs, and logs out', async () => {
    const login = await request('/api/admin/session', { method: 'POST', body: { password: SECRET } })
    expect(login.status).toBe(200)
    const setCookie = login.headers.get('set-cookie')!
    expect(setCookie).toMatch(/admin-session=/)
    expect(setCookie).toMatch(/HttpOnly/i)
    expect(setCookie).toMatch(/Secure/i)
    expect(setCookie).toMatch(/SameSite=Strict/i)
    expect(setCookie).toMatch(/Max-Age=43200/i)
    const cookie = setCookie.split(';')[0]!
    expect((await request('/api/admin/session', { headers: { cookie } })).status).toBe(200)
    expect((await request('/api/review/submissions', { headers: { cookie } })).status).toBe(200)
    const logout = await request('/api/admin/session', { method: 'DELETE', headers: { cookie } })
    expect(logout.status).toBe(200)
    expect(logout.headers.get('set-cookie')).toMatch(/Max-Age=0/i)
  })
})

describe('POST /api/submissions', () => {
  it('stores a heritage correction with its atlas target', async () => {
    const response = await submit({
      ...valid,
      type: 'correction',
      targetRef: 'kalnik-crkva-sv-brcka',
      text: 'Zapis: Crkva sv. Brcka\n\nPredloženi ispravak:\nTitular u izvoru je drugačiji.',
      placeId: null,
      name: null,
      contact: null
    })
    expect(response.status).toBe(201)
    const stored = (await listAll()).find(row => row.type === 'correction' && row.targetRef === 'kalnik-crkva-sv-brcka')
    expect(stored).toMatchObject({
      type: 'correction',
      targetRef: 'kalnik-crkva-sv-brcka',
      status: 'pending'
    })
  })

  it('rejects corrections with an unknown atlas target', async () => {
    const response = await submit({
      ...valid,
      type: 'correction',
      targetRef: 'nepostojeci-zapis',
      text: 'Zapis: test\n\nPredloženi ispravak:\nNešto.'
    })
    expect(response.status).toBe(400)
    expect((await response.json()).data.issues).toContainEqual({ field: 'targetRef', code: 'invalid' })
  })

  it('requires a valid place for variant reports while ordinary word contributions may omit it', async () => {
    const text = 'variant place validation test'
    for (const placeId of [undefined, null, '', '   ', 'forged', 'geonames:9999999999', 'geonames:3194379']) {
      const response = await submit({ ...valid, type: 'word', reportKind: 'variant', text, placeId })
      expect(response.status).toBe(400)
      expect((await response.json()).data.issues).toContainEqual(expect.objectContaining({ field: 'place', code: !placeId?.trim() ? 'required' : placeId === 'geonames:3194379' ? 'outOfScope' : 'invalid' }))
    }
    expect((await listAll()).some(row => row.text === text)).toBe(false)
    expect((await submit({ ...valid, type: 'word', text: 'general word without place', placeId: null })).status).toBe(201)
    expect((await submit({ ...valid, type: 'word', reportKind: 'variant', text: 'variant with valid place' })).status).toBe(201)
  })

  it('stores a valid submission as pending, with the consent recorded', async () => {
    const response = await submit({ ...valid, text: 'stored submission' })
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ ok: true })

    const stored = (await listAll()).find(row => row.text === 'stored submission')
    expect(stored).toMatchObject({
      type: 'expression',
      targetRef: null,
      place: 'Sveti Petar Orehovec (geonames:3194024)',
      placeId: 'geonames:3194024',
      placeCatalogVersion: expect.any(String),
      placeContext: 'Sveti Petar Orehovec · Koprivničko-križevačka županija',
      name: 'Ana',
      contact: 'ana@example.com',
      consentPublish: true,
      consentVersion: expect.any(String),
      locale: 'hr',
      status: 'pending',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
      reviewedAt: null
    })
  })

  it('ignores client-supplied status, review metadata, id and consent version', async () => {
    const response = await submit({ ...valid, text: 'server controlled fields', status: 'approved', reviewed_at: '2026-01-01', id: 999999, consent_version: 'forged' })
    expect(response.status).toBe(201)
    const stored = (await listAll()).find(row => row.text === 'server controlled fields')!
    expect(stored).toMatchObject({ status: 'pending', reviewedAt: null })
    expect(stored.id).not.toBe(999999)
    expect(stored.consentVersion).not.toBe('forged')
  })

  it('rejects a submission without consent to publish and stores nothing', async () => {
    for (const consentPublish of [undefined, false, 'true']) {
      const response = await submit({ ...valid, text: 'no consent', consentPublish })
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.data.issues).toContainEqual({ field: 'consentPublish', code: 'required' })
    }
    expect((await listAll()).some(row => row.text === 'no consent')).toBe(false)
  })

  it('validates the fields on the server', async () => {
    const response = await submit({ text: 'x'.repeat(2001), type: 'poem', name: 'n'.repeat(101), consentPublish: true, locale: 'de' })
    expect(response.status).toBe(400)
    expect((await response.json()).data.issues).toEqual([
      { field: 'text', code: 'tooLong' },
      { field: 'type', code: 'invalid' },
      { field: 'name', code: 'tooLong' },
      { field: 'locale', code: 'invalid' }
    ])
  })

  it('rejects an oversized request body', async () => {
    const response = await submit({ ...valid, text: 'x'.repeat(20_000) })
    expect(response.status).toBe(413)
  })

  it('refuses a body without a Content-Length, such as a chunked one, and stores nothing', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ ...valid, text: 'chunked submission' })))
        controller.close()
      }
    })
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': newClient() },
      body,
      duplex: 'half'
    } as RequestInit)
    expect(response.status).toBe(411)
    expect((await listAll()).some(row => row.text === 'chunked submission')).toBe(false)
  })

  it('silently drops submissions that fill in the honeypot', async () => {
    const response = await submit({ ...valid, text: 'honeypot submission', website: 'https://spam.example' })
    expect(response.status).toBe(201)
    expect((await listAll()).some(row => row.text === 'honeypot submission')).toBe(false)
  })

  it('limits submissions per client address', async () => {
    const ip = newClient()
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect((await submit({ ...valid, text: `rate limit ${i}` }, ip)).status).toBe(201)
    }
    expect((await submit({ ...valid, text: 'rate limit over' }, ip)).status).toBe(429)
    expect((await submit({ ...valid, text: 'rate limit other client' })).status).toBe(201)
  })

  it('counts by the proxy-added address, so a faked X-Forwarded-For prefix does not reset the limit', async () => {
    const ip = newClient()
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect((await submit({ ...valid, text: `spoofed ${i}` }, `198.51.100.${i}, ${ip}`)).status).toBe(201)
    }
    expect((await submit({ ...valid, text: 'spoofed over' }, `198.51.100.99, ${ip}`)).status).toBe(429)
  })
})

describe('Croatian place search and selection API', () => {
  it('searches Potkalničko prigorje settlements without diacritics and preserves labels', async () => {
    const response = await request('/api/places?q=krizevci')
    expect(response.status).toBe(200)
    const found = await response.json()
    expect(found.places[0]).toMatchObject({ id: 'geonames:3197230', name: 'Križevci', municipality: 'Križevci' })
    expect(found.version).toMatch(/^hr-geonames-/)
    const outside = await (await request('/api/places?q=cakovec')).json()
    expect(outside.places).toEqual([])
    const duplicates = await (await request('/api/places?q=novigrad')).json()
    expect(duplicates.places).toEqual([])
  })

  it('never returns settlements outside the five municipalities', async () => {
    const response = await (await request('/api/places?q=gr')).json()
    expect(response.places.length).toBeGreaterThan(0)
    for (const place of response.places) {
      expect(['Križevci', 'Kalnik', 'Gornja Rijeka', 'Sveti Petar Orehovec', 'Sveti Ivan Žabno']).toContain(place.municipality)
    }
  })

  it('bounds query length, result count and short searches; does not return the catalog', async () => {
    expect((await (await request('/api/places?q=a')).json()).places).toEqual([])
    expect((await request(`/api/places?q=${'a'.repeat(81)}`)).status).toBe(400)
    expect((await request('/api/places?q=kr&q=za')).status).toBe(400)
    const response = await (await request('/api/places?q=gr')).json()
    expect(response.places.length).toBeLessThanOrEqual(8)
    expect(response.places.length).toBeGreaterThan(0)
    expect(Object.keys(response.places[0]).sort()).toEqual(['county', 'id', 'municipality', 'name'])
    const ignored = await (await request('/api/places?q=gr&limit=1')).json()
    expect(ignored.places).toHaveLength(response.places.length)
  })

  it('limits search abuse independently from submissions', async () => {
    const ip = newClient()
    for (let i = 0; i < 120; i++) expect((await request('/api/places?q=kr', { ip })).status).toBe(200)
    expect((await request('/api/places?q=kr', { ip })).status).toBe(429)
    expect((await submit({ ...valid, text: 'search independent' }, ip)).status).toBe(201)
  })

  it('allows omitted and explicitly empty locations', async () => {
    for (const value of [{}, { placeId: null }, { place: '' }]) {
      const response = await submit({ text: 'optional location', consentPublish: true, locale: 'hr', ...value })
      expect(response.status).toBe(201)
    }
    const stored = (await listAll()).filter(row => row.text === 'optional location')
    expect(stored).toHaveLength(3)
    expect(stored.every(row => row.place === null && row.placeId === null && row.placeCatalogVersion === null)).toBe(true)
  })

  it('rejects unknown, foreign, forged and inactive IDs with a localized place-field issue', async () => {
    const { default: catalog } = await import('../server/data/places/hr.json')
    const inactive = catalog.places.find(place => !place.active)!.id
    for (const placeId of ['geonames:9999999999', 'geonames:2988507', 'paris', inactive]) {
      const response = await submit({ ...valid, text: 'bad place choice', placeId, locale: 'en', countryCode: 'HR' })
      expect(response.status).toBe(400)
      const issue = (await response.json()).data.issues[0]
      expect(issue).toMatchObject({ field: 'place', code: 'invalid', message: expect.stringContaining('Croatian settlement') })
    }
    expect((await listAll()).some(row => row.text === 'bad place choice')).toBe(false)
  })

  it('rejects Croatian settlements outside Potkalničko prigorje with a localized out-of-scope issue', async () => {
    const response = await submit({ ...valid, text: 'outside prigorje', placeId: 'geonames:3194379', locale: 'hr' })
    expect(response.status).toBe(400)
    const issue = (await response.json()).data.issues[0]
    expect(issue).toMatchObject({
      field: 'place',
      code: 'outOfScope',
      message: expect.stringContaining('Potkalničkom prigorju')
    })
    expect((await listAll()).some(row => row.text === 'outside prigorje')).toBe(false)
  })

  it('requires cached free-text clients to refresh and reselect, even alongside an ID', async () => {
    for (const placeId of [null, valid.placeId]) {
      const response = await submit({ ...valid, text: 'legacy text rejected', placeId, place: 'Paris', locale: 'en' })
      expect(response.status).toBe(400)
      expect((await response.json()).data.issues).toContainEqual({ field: 'place', code: 'refreshPlace', message: expect.stringContaining('Refresh this form') })
    }
    expect((await listAll()).some(row => row.text === 'legacy text rejected')).toBe(false)
  })

  it('ignores spoofed labels, country, coordinates and catalog version', async () => {
    expect((await submit({ ...valid, text: 'trusted place metadata', placeName: 'Paris', countryCode: 'FR', latitude: 0, longitude: 0, placeCatalogVersion: 'forged' })).status).toBe(201)
    const stored = (await listAll()).find(row => row.text === 'trusted place metadata')!
    expect(stored.place).toBe('Sveti Petar Orehovec (geonames:3194024)')
    expect(stored.placeCatalogVersion).not.toBe('forged')
  })

  it.skipIf(!fake)('keeps legacy free-text review rows readable and unassigned', async () => {
    fake!.seed({ text: 'legacy location row', place: 'Somewhere near Orehovec', locale: 'hr', type: null, name: null, contact: null, consent_publish: true, consent_version: '2026-10-27' })
    expect((await listAll()).find(row => row.text === 'legacy location row')).toMatchObject({ place: 'Somewhere near Orehovec', placeId: null, placeCatalogVersion: null, placeContext: null })
  })
})

describe('review API', () => {
  const routes = [
    { method: 'GET', path: '/api/review/submissions' },
    { method: 'PATCH', path: '/api/review/submissions/1', body: { status: 'approved' } },
    { method: 'DELETE', path: '/api/review/submissions/1' }
  ]

  it.each(routes)('$method $path requires the review secret', async ({ method, path, body }) => {
    expect((await request(path, { method, body })).status).toBe(401)
    expect((await request(path, { method, body, secret: 'wrong-secret-0123456789' })).status).toBe(401)
    expect((await request(path, { method, body, headers: { authorization: SECRET } })).status).toBe(401)
  })

  it('does not change anything without the secret', async () => {
    await submit({ ...valid, text: 'protected submission' })
    const { id } = (await listAll()).find(row => row.text === 'protected submission')!

    expect((await request(`/api/review/submissions/${id}`, { method: 'PATCH', body: { status: 'approved' } })).status).toBe(401)
    expect((await request(`/api/review/submissions/${id}`, { method: 'DELETE' })).status).toBe(401)
    expect((await listAll()).find(row => row.id === id)).toMatchObject({ status: 'pending' })
  })

  it('locks out a client after too many wrong secrets', async () => {
    const ip = newClient()
    for (let i = 0; i < 10; i++) {
      expect((await request('/api/review/submissions', { secret: 'guess', ip })).status).toBe(401)
    }
    expect((await request('/api/review/submissions', { secret: 'guess', ip })).status).toBe(429)
    expect((await request('/api/review/submissions', { secret: SECRET, ip })).status).toBe(429)
  })

  it('keeps the lockout when the client changes the left part of X-Forwarded-For', async () => {
    const ip = newClient()
    for (let i = 0; i < 10; i++) {
      expect((await request('/api/review/submissions', { secret: 'guess', ip: `198.51.100.${i}, ${ip}` })).status).toBe(401)
    }
    expect((await request('/api/review/submissions', { secret: SECRET, ip: `198.51.100.99, ${ip}` })).status).toBe(429)
  })

  it('lists every pending submission, with no cap', async () => {
    const texts = Array.from({ length: 1001 }, (_, i) => `uncapped ${i}`)
    for (const [i, text] of texts.entries()) {
      expect((await submit({ ...valid, text }, `10.0.${i >> 8}.${i & 255}`)).status).toBe(201)
    }
    const response = await request('/api/review/submissions', { secret: SECRET })
    const rows = await response.json() as Array<Record<string, unknown>>
    const listed = new Set(rows.map(row => row.text))
    expect(texts.every(text => listed.has(text))).toBe(true)
  })

  it('lists pending submissions by default', async () => {
    await submit({ ...valid, text: 'listed submission' })
    const response = await request('/api/review/submissions', { secret: SECRET })
    expect(response.status).toBe(200)
    const rows = await response.json() as Array<Record<string, unknown>>
    expect(rows.every(row => row.status === 'pending')).toBe(true)
    expect(rows.some(row => row.text === 'listed submission')).toBe(true)

    expect((await request('/api/review/submissions?status=nope', { secret: SECRET })).status).toBe(400)
  })

  it('filters review submissions by type', async () => {
    await submit({
      ...valid,
      type: 'correction',
      targetRef: 'kalnik-crkva-sv-brcka',
      text: 'type filter correction row',
      placeId: null
    })
    await submit({ ...valid, text: 'type filter ordinary row', type: 'memory' })
    const response = await request('/api/review/submissions?status=all&type=correction', { secret: SECRET })
    expect(response.status).toBe(200)
    const rows = await response.json() as Array<{ type: string | null, text: string }>
    expect(rows.every(row => row.type === 'correction')).toBe(true)
    expect(rows.some(row => row.text === 'type filter correction row')).toBe(true)
    expect(rows.some(row => row.text === 'type filter ordinary row')).toBe(false)
  })

  it('approves, rejects and deletes a submission', async () => {
    await submit({ ...valid, text: 'reviewed submission' })
    const { id } = (await listAll()).find(row => row.text === 'reviewed submission')!
    const path = `/api/review/submissions/${id}`

    expect((await request(path, { method: 'PATCH', body: { status: 'approved' }, secret: SECRET })).status).toBe(200)
    const approved = await (await request('/api/review/submissions?status=approved', { secret: SECRET })).json() as Array<Record<string, unknown>>
    expect(approved.find(row => row.id === id)).toMatchObject({ status: 'approved', reviewedAt: expect.any(String) })

    expect((await request(path, { method: 'PATCH', body: { status: 'rejected' }, secret: SECRET })).status).toBe(200)
    expect((await listAll()).find(row => row.id === id)).toMatchObject({ status: 'rejected' })

    expect((await request(path, { method: 'PATCH', body: { status: 'published' }, secret: SECRET })).status).toBe(400)

    expect((await request(path, { method: 'DELETE', secret: SECRET })).status).toBe(200)
    expect((await listAll()).some(row => row.id === id)).toBe(false)
    expect((await request(path, { method: 'DELETE', secret: SECRET })).status).toBe(404)
    expect((await request(path, { method: 'PATCH', body: { status: 'approved' }, secret: SECRET })).status).toBe(404)
    expect((await request('/api/review/submissions/abc', { method: 'DELETE', secret: SECRET })).status).toBe(400)
  })
})

describe.skipIf(!fake)('Supabase keys', () => {
  it('submits and reviews with the same secret key', () => {
    const inserts = fake!.requests.filter(r => r.method === 'POST')
    const others = fake!.requests.filter(r => r.method !== 'POST')
    expect(inserts.length).toBeGreaterThan(0)
    expect(others.length).toBeGreaterThan(0)
    expect(inserts.every(r => r.role === 'service_role')).toBe(true)
    expect(others.every(r => r.role === 'service_role')).toBe(true)
  })
})

describe('server-only credentials', () => {
  it('does not publish the database key or review password in HTML or built public files', async () => {
    const secrets = [supabase.serviceRoleKey, SECRET, process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_API_KEY].filter((value): value is string => Boolean(value))
    for (const path of ['/heritage', '/en/heritage', '/review']) {
      const html = await (await fetch(path)).text()
      for (const secret of secrets) expect(html).not.toContain(secret)
    }
    const publicDir = resolve(useTestContext().nuxt!.options.nitro.output.dir!, 'public')
    const files = await readdir(publicDir, { recursive: true, withFileTypes: true })
    expect(files.filter(file => file.isFile()).length).toBeGreaterThan(0)
    for (const file of files.filter(file => file.isFile())) {
      const output = await readFile(`${file.parentPath}/${file.name}`)
      for (const secret of secrets) expect(output.includes(Buffer.from(secret)), file.name).toBe(false)
      expect(output.includes(Buffer.from('centroidOutsideOfficialBoundary')), file.name).toBe(false)
    }
  })
})

describe('multiple-choice pages', () => {
  it('renders Croatian loading copy for the client-fetched quiz from the production server', async () => {
    const response = await fetch('/potkalnicko-prigorje/igre/kviz')
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/<html[^>]+lang="hr-HR"/)
    expect(html).toContain('Ponuđeni odgovori')
    expect(html).toContain('Učitavam pitanja…')
    expect(html).not.toContain('Trebamo još riječi')
    expect(html).toContain('role="status"')
    expect(html).not.toContain('/potkalnicko-prigorje/igre/kartice')
  })
})

function metaContent(html: string, key: string) {
  const tag = html.match(new RegExp(`<meta[^>]+(?:name|property)="${key}"[^>]*>`))?.[0]
  return tag?.match(/content="([^"]*)"/)?.[1]
}

describe('public discovery, sharing metadata and error pages', () => {
  it('publishes only public localized routes in the sitemap and blocks private routes in robots.txt', async () => {
    const sitemap = await (await fetch('/sitemap.xml')).text()
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])
    const noindexPaths = new Set(getAtlas().heritage
      .filter(item => item.noindex && item.settlementCode)
      .map(item => `/potkalnicko-prigorje/bastina/${settlementByCode(item.settlementCode!)!.slug}/${item.slug}`))
    expect(urls).toEqual([
      'https://karlo-siladi.from.hr/',
      'https://karlo-siladi.from.hr/en',
      ...atlasPrerenderRoutes.filter(path => !noindexPaths.has(path)).map(path => `https://karlo-siladi.from.hr${path}`)
    ])
    expect(sitemap).not.toContain('/heritage')
    expect(sitemap).not.toContain('/en/potkalnicko-prigorje')

    const robots = await (await fetch('/robots.txt')).text()
    for (const path of ['/admin', '/api/']) {
      expect(robots).toContain(`Disallow: ${path}`)
    }
    expect(robots).toContain('Sitemap: https://karlo-siladi.from.hr/sitemap.xml')
  })

  it.each([
    { path: '/', title: 'Karlo Siladi', description: 'Karlo Siladi izrađuje stvari', image: 'share-hr.jpg' },
    { path: '/en', title: 'Karlo Siladi', description: 'Karlo Siladi builds things', image: 'share-en.jpg' },
    { path: '/potkalnicko-prigorje', title: 'Potkalnički zapisi', description: 'Istraži mjesta', image: 'og.svg' },
    { path: '/potkalnicko-prigorje/igre', title: 'Igre i kvizovi · Potkalnički zapisi', description: 'Izazovi prijatelja', image: 'og.svg' },
    { path: '/potkalnicko-prigorje/doprinesi', title: 'Doprinesi · Potkalnički zapisi', description: 'Sve što pošalješ', image: 'og.svg' },
    { path: '/potkalnicko-prigorje/o-projektu', title: 'O projektu · Potkalnički zapisi', description: 'digitalni zavičajni atlas', image: 'og.svg' },
    { path: '/potkalnicko-prigorje/igre/kartice', title: 'Kaj to znači? · Potkalnički zapisi', description: 'Kartice s riječima', image: 'og.svg' },
    { path: '/potkalnicko-prigorje/igre/kviz', title: 'Ponuđeni odgovori · Potkalnički zapisi', description: 'Pročitaj riječ', image: 'og.svg' },
    { path: '/potkalnicko-prigorje/privatnost', title: 'Obavijest o privatnosti · Potkalnički zapisi', description: 'Koje podatke', image: 'og.svg' }
  ])('sets localized sharing metadata on $path', async ({ path, title, description, image }) => {
    const response = await fetch(path)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(metaContent(html, 'og:title')).toBe(title)
    expect(metaContent(html, 'og:description')).toContain(description)
    expect(metaContent(html, 'og:image')).toContain(image)
    expect(metaContent(html, 'twitter:card')).toBe('summary_large_image')
  })

  it('documents Umami visit analytics on the privacy notice', async () => {
    const html = await (await fetch('/potkalnicko-prigorje/privatnost', { headers: { accept: 'text/html' } })).text()
    expect(html).toContain('Umami Cloud')
    expect(html).toContain('kolačiće')
    expect(html).toContain('1. studenoga 2026.')
  })

  it('does not show coming-soon hero badges on the portfolio or app home', async () => {
    for (const path of ['/', '/potkalnicko-prigorje']) {
      const html = await (await fetch(path, { headers: { accept: 'text/html' } })).text()
      expect(html).not.toContain('i-lucide-construction')
    }
    const portfolio = await (await fetch('/', { headers: { accept: 'text/html' } })).text()
    expect(portfolio).toContain('Projekt 1 · Za zajednicu')
    const heritageBlock = portfolio.split('id="heritage"')[1]?.split('id="projects"')[0] ?? ''
    expect(heritageBlock).not.toContain('i-lucide-sparkles')
  })

  it.each(['/heritage', '/privacy', '/review', '/review-words', '/en/potkalnicko-prigorje'])('does not keep the retired page route %s', async (path) => {
    expect((await fetch(path, { headers: { accept: 'text/html' } })).status).toBe(404)
  })

  it.each([
    { path: '/missing-page', lang: 'hr-HR', title: 'Stranica nije pronađena', home: 'Na početnu' },
    { path: '/en/missing-page', lang: 'en-GB', title: 'Page not found', home: 'Back to home' },
    { path: '/admin/nema-stranice', lang: 'hr-HR', title: 'Stranica nije pronađena', home: 'Na početnu', admin: true }
  ])('returns a localized, non-indexable 404 for $path', async ({ path, lang, title, home, admin }) => {
    const response = await fetch(path, { headers: { accept: 'text/html' } })
    expect(response.status).toBe(404)
    const html = await response.text()
    expect(html).toMatch(new RegExp(`<html[^>]+lang="${lang}"`))
    expect(html).toContain(title)
    expect(html).toContain(home)
    if (admin) {
      expect(html).toContain('Administracija')
      expect(html).toContain('Odjava')
      expect(html).not.toContain('aria-label="Karlo Siladi"')
      expect(metaContent(html, 'robots')).toBe('noindex, nofollow')
    } else {
      expect(metaContent(html, 'robots')).toBe('noindex')
    }
  })
})

// These restart the server with other settings, so they come last.
const blank = { NUXT_SUPABASE_URL: '', NUXT_SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_URL: '', SUPABASE_API_KEY: '' }
const reviewRoutes = [
  { method: 'GET', path: '/api/review/submissions' },
  { method: 'PATCH', path: '/api/review/submissions/1', body: { status: 'approved' } },
  { method: 'DELETE', path: '/api/review/submissions/1' },
  { method: 'GET', path: '/api/review/words' },
  { method: 'POST', path: '/api/review/words', body: wordInput() },
  { method: 'PUT', path: '/api/review/words/missing', body: wordInput() },
  { method: 'POST', path: '/api/review/submissions/1/word' }
]

describe('Supabase settings', () => {
  it('submits and reviews using only the names Hostinger injects', async () => {
    await startServer({ env: { ...blank, SUPABASE_URL: supabase.url, SUPABASE_API_KEY: supabase.serviceRoleKey } })
    expect((await submit({ ...valid, text: 'plain names' })).status).toBe(201)
    expect((await listAll()).some(row => row.text === 'plain names')).toBe(true)
  })

  it('prefers the NUXT overrides when both naming styles are set', async () => {
    await startServer({ env: {
      ...blank,
      NUXT_SUPABASE_URL: supabase.url,
      NUXT_SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
      SUPABASE_URL: 'http://127.0.0.1:1',
      SUPABASE_API_KEY: 'invalid-fallback'
    } })
    expect((await submit({ ...valid, text: 'override names' })).status).toBe(201)
    expect((await listAll()).some(row => row.text === 'override names')).toBe(true)
  })

  it.each([
    { name: 'secret key', settings: { NUXT_SUPABASE_URL: supabase.url }, missing: 'NUXT_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_API_KEY)' },
    { name: 'URL', settings: { SUPABASE_API_KEY: supabase.serviceRoleKey }, missing: 'NUXT_SUPABASE_URL (or SUPABASE_URL)' }
  ])('refuses submissions and all review routes without the $name and logs the missing variable', async ({ settings, missing }) => {
    await startServer({ env: { ...blank, ...settings } })
    expect((await submit({ ...valid, text: 'no database' })).status).toBe(503)
    expect((await request('/api/heritage/words')).status).toBe(503)
    for (const route of reviewRoutes) {
      expect((await request(route.path, { ...route, secret: SECRET })).status).toBe(503)
    }
    expect((await request('/api/review/submissions', { secret: 'wrong-secret-0123456789' })).status).toBe(401)
    expect(getServerLogs().join('\n')).toContain(`${missing} is not set`)
  })

  it.each(['', 'too-short'])('keeps review disabled with an invalid review password (%s)', async (reviewSecret) => {
    await startServer({ env: { ...blank, SUPABASE_URL: supabase.url, SUPABASE_API_KEY: supabase.serviceRoleKey, NUXT_REVIEW_SECRET: reviewSecret } })
    expect((await submit({ ...valid, text: 'password disabled' })).status).toBe(201)
    for (const route of reviewRoutes) {
      expect((await request(route.path, { ...route, secret: SECRET })).status).toBe(503)
    }
  })
})

describe('Umami analytics', () => {
  for (const path of ['/', '/potkalnicko-prigorje', '/admin/prijava']) {
    it(`serves ${path} without any third-party analytics script or website ID`, async () => {
      const html = await (await fetch(path)).text()
      expect(html).not.toContain('cloud.umami.is')
      expect(html).not.toContain('c554cf77-732f-4f2d-bfbc-5f0b78492f4c')
    })
  }
})
