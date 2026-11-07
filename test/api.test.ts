import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { fetch, getServerLogs, startServer, url, useTestContext } from '@nuxt/test-utils/e2e'
import { SERVICE_ROLE_KEY, startFakeSupabase } from './helpers/fakeSupabase'
import { createClient } from '@supabase/supabase-js'
import type { AdminWord, PublicWords, WordInput } from '../shared/utils/word'
import atlasPrerenderRoutes from './fixtures/atlas/prerender-routes.json'
import { getAtlas, heritageItemByRoute, settlementByCode } from './helpers/atlasFixtures'
import { buildPublicContent } from '../server/utils/publicContent'
import { sitemapEntries, SITE_URL } from '../server/utils/sitemap'
import { fakeContentRows } from './helpers/fakeContentSeed'
import { contentUuid } from './helpers/contentUuid'
import { setupNuxtServer } from './support/nuxtServer'

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

await setupNuxtServer({
  NUXT_SUPABASE_URL: supabase.url,
  NUXT_SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
  NUXT_REVIEW_SECRET: SECRET,
  // Keep the daily word closed here so the runtime-config override stays covered.
  NUXT_DAILY_WORD_EPOCH: '9999-01-01',
  NUXT_ADMIN_SESSION_PASSWORD: SESSION_PASSWORD,
  NUXT_SUBMISSION_RATE_LIMIT_MAX: String(RATE_LIMIT_MAX)
})

let ipCounter = 0
// Each test gets its own client address so the per-IP limits don't leak between tests.
function newClient() {
  ipCounter++
  return `203.0.113.${ipCounter}`
}

function request(path: string, init: { method?: string, body?: unknown, secret?: string, ip?: string, headers?: Record<string, string>, redirect?: RequestRedirect } = {}) {
  const headers: Record<string, string> = { 'x-forwarded-for': init.ip ?? newClient(), ...init.headers }
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  if (init.secret !== undefined) headers.authorization = `Bearer ${init.secret}`
  return fetch(path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    redirect: init.redirect
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

// An imported area (the town of Križevci): its id is the same in the fake and in the real database, and words
// refer to areas by id, so a usage needs a row in the areas table to be public.
const TEST_AREA = contentUuid('area:krizevci')

function wordInput(active = false): WordInput {
  return {
    entry: {
      id: 'client-id-is-ignored', headword: 'testna riječ', meaning: { hr: 'testno značenje', en: 'test meaning' }, partOfSpeech: 'imenica',
      status: 'community', sources: [{ id: 'editor', kind: 'editor', credit: 'Local test' }],
      examples: [{ text: 'Primjer riječi.', translation: 'Example.' }],
      variants: [{ id: 'test-variant', form: 'testna riječ', status: 'community', usages: [{ areaId: TEST_AREA, confidence: 'reported', sourceId: 'editor' }] }]
    },
    areas: [], active
  }
}

// Words are written straight to the table: the admin writes them through /api/admin/content/word, which needs the
// real database (test/adminWords.integration.test.ts). The areas of a word are never stored with it.
async function createWord(input: WordInput = wordInput()) {
  const id = randomUUID()
  const entry = { ...input.entry, id }
  const { error } = await db.from('heritage_words').insert({ id, entry, active: input.active })
  expect(error).toBeNull()
  wordIds.push(id)
  return { entry, active: input.active }
}
async function updateWord(id: string, patch: Record<string, unknown>) {
  const { error } = await db.from('heritage_words').update(patch).eq('id', id)
  expect(error).toBeNull()
}
async function readPublic(limit?: number) {
  const response = await request(`/api/heritage/words${limit ? `?limit=${limit}` : ''}`)
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toContain('max-age=30')
  return await response.json() as PublicWords
}

describe('Potkalnički zapisi learning and challenge choice', () => {
  it('serves the play catalogue and friend challenge on the games hub', async () => {
    const response = await request('/potkalnicko-prigorje/igre')
    expect(response.status).toBe(200)
    const html = await response.text()
    const { Window } = await import('happy-dom')
    const window = new Window({ url: url('/') }) // resolves the page's relative preload links
    window.document.body.innerHTML = html
    const catalog = window.document.querySelector('[data-testid="play-catalog"]')!
    expect(catalog).not.toBeNull()
    expect(window.document.querySelector('[data-testid="friend-challenge-card"]')?.textContent).toContain('Izazovi prijatelja')
    expect(window.document.querySelector('[data-testid="game-tile-znacenje"]')).not.toBeNull()
    expect(window.document.querySelector('[data-testid="game-tile-kartice"]')).not.toBeNull()
    expect(window.document.querySelector('header')?.textContent).toContain('Igre')
    expect(window.document.querySelector('header')?.textContent).toContain('Doprinesi')
    expect(window.document.querySelector('header')?.textContent).toContain('O projektu')
    expect(window.document.querySelector('header')?.textContent).not.toContain('Karlo Siladi')
    await window.happyDOM.close()
  })

  it('redirects legacy kartice URL to the learn setup page', async () => {
    const response = await request('/potkalnicko-prigorje/igre/kartice', { redirect: 'manual' })
    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toContain('/potkalnicko-prigorje/uci?teme=rijeci')
  })
})

describe('Potkalnički zapisi app home', () => {
  it('renders the phase 2 hero, project scope teaser and contribute band', async () => {
    const response = await request('/potkalnicko-prigorje')
    expect(response.status).toBe(200)
    const html = await response.text()
    const { Window } = await import('happy-dom')
    const window = new Window({ url: url('/') }) // resolves the page's relative preload links
    window.document.body.innerHTML = html
    expect(window.document.body.textContent).toContain('Otkrij priče koje čine Potkalničko prigorje.')
    expect(html).toContain('data-testid="learn-play-switch"')
    expect(html).toMatch(/\bUči\b/)
    expect(html).toContain('/potkalnicko-prigorje/igre')
    expect(window.document.querySelector('#doprinos')).not.toBeNull()
    expect(window.document.querySelector('a[href="/potkalnicko-prigorje/doprinesi"]')).not.toBeNull()
    const scope = window.document.querySelector('[data-testid="obuhvat"]')
    expect(scope?.textContent).toContain('Pet općina')
    expect(scope?.textContent).toContain('Radni obuhvat projekta, ne službena granica prigorja.')
    expect(scope?.textContent).not.toContain('Pet područja')
    expect(scope?.textContent).toContain('Grad Križevci')
    expect(scope?.textContent).toContain('60 naselja · 34 zapisa')
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
    const pickerWindow = new Window({ url: url('/') }) // resolves the page's relative preload links
    pickerWindow.document.body.innerHTML = pickerHtml
    expect(pickerWindow.document.querySelector('[data-testid="contribute-type-picker"]')).not.toBeNull()
    expect(pickerHtml).toContain('Pošalji riječ ili izraz')
    expect(pickerHtml).toContain('Novi zapis baštine')
    expect(pickerHtml).toContain('Izvor ili literatura')
    expect(pickerHtml).toContain('Ispravak')
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
  it('renders the play catalogue with the daily word first', async () => {
    const response = await request('/potkalnicko-prigorje/igre')
    expect(response.status).toBe(200)
    const html = await response.text()
    const { Window } = await import('happy-dom')
    const window = new Window({ url: url('/') }) // resolves the page's relative preload links
    window.document.body.innerHTML = html
    const catalog = window.document.querySelector('[data-testid="play-catalog"]')!
    expect(catalog).not.toBeNull()
    const daily = window.document.querySelector('#rijec-dana')!
    expect(daily).not.toBeNull()
    expect(daily.compareDocumentPosition(catalog) & 4).toBeTruthy()
    expect(window.document.querySelector('#rijec-dana [data-testid="daily-skeleton"]')).not.toBeNull()
    expect(catalog.querySelector('[data-testid="game-tile-znacenje"]')).not.toBeNull()
    expect(catalog.querySelector('[data-testid="game-tile-znacenje"]')?.textContent).toContain('Kaj to znači?')
    await window.happyDOM.close()
  })
})

describe('word admin and public word APIs', () => {
  it('prerenderes learn routes with a client-side loading skeleton', async () => {
    for (const path of ['/potkalnicko-prigorje/uci', '/potkalnicko-prigorje/uci/sesija']) {
      const response = await request(path)
      expect(response.status).toBe(200)
      expect(await response.text()).toMatch(/Uči|Lekcija/)
    }
  })

  it.each([
    { method: 'POST', path: '/api/review/submissions/1/word' },
    { method: 'GET', path: '/api/review/daily' },
    { method: 'PUT', path: '/api/review/daily/2099-01-01', body: { wordId: 'anything' } },
    { method: 'DELETE', path: '/api/review/daily/2099-01-01' }
  ])('$method $path rejects unauthenticated access before doing any work', async ({ method, path, body }) => {
    expect((await request(path, { method, body })).status).toBe(401)
    expect((await request(path, { method, body, secret: 'wrong' })).status).toBe(401)
  })

  it('retired the review word routes: words are written through the admin content API only', async () => {
    for (const [method, path] of [['GET', '/api/review/words'], ['POST', '/api/review/words'], ['PUT', '/api/review/words/anything']]) {
      expect((await request(path, { method, secret: SECRET, body: method === 'GET' ? undefined : wordInput() })).status, `${method} ${path}`).toBe(404)
    }
  })

  it('serves an activated word with all WordEntry parameters and hides it again when deactivated', async () => {
    const word = await createWord()
    expect(word).toMatchObject({ active: false })
    expect((await readPublic()).words.some(w => w.id === word.entry.id)).toBe(false)
    await updateWord(word.entry.id, { active: true, entry: { ...word.entry, meaning: { hr: 'novo značenje' } } })
    const published = (await readPublic()).words.find(w => w.id === word.entry.id)
    expect(published).toMatchObject({ meaning: { hr: 'novo značenje' }, examples: word.entry.examples, variants: word.entry.variants, sources: word.entry.sources })
    await updateWord(word.entry.id, { active: false })
    expect((await readPublic()).words.some(w => w.id === word.entry.id)).toBe(false)
  })

  it('serves the areas a word points at, with their ancestors, from the areas table', async () => {
    const word = await createWord(wordInput(true))
    const result = await readPublic()
    expect(result.words.some(w => w.id === word.entry.id)).toBe(true)
    const town = result.areas.find(area => area.id === TEST_AREA)
    expect(town).toMatchObject({ name: 'Križevci', kind: 'town', parentId: expect.stringMatching(/^[0-9a-f-]{36}$/) })
    // The county and the country above it come along, parents before children.
    const ids = result.areas.map(area => area.id)
    expect(ids.indexOf(town!.parentId!)).toBeGreaterThanOrEqual(0)
    expect(ids.indexOf(town!.parentId!)).toBeLessThan(ids.indexOf(TEST_AREA))
  })

  it('does not publish a word whose usage points at an area that does not exist', async () => {
    const input = wordInput(true)
    input.entry.variants[0]!.usages = [{ areaId: 'hr-kkz-krizevci-gone', confidence: 'reported' }]
    const word = await createWord(input)
    expect((await readPublic()).words.some(w => w.id === word.entry.id)).toBe(false)
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
    expect(word.entry.variants[0]?.usages).toMatchObject([{ areaId: expect.stringMatching(/^[0-9a-f-]{36}$/), confidence: 'reported' }])
    expect(JSON.stringify(word)).not.toContain(valid.contact)
    const repeat = await (await request(path, { method: 'POST', secret: SECRET })).json() as AdminWord
    expect(repeat.entry.id).toBe(word.entry.id)
    expect((await listAll()).find(s => s.id === submission.id)?.status).toBe('pending')
    expect((await readPublic()).words.some(w => w.id === word.entry.id)).toBe(false)
    expect((await listAll()).find(s => s.id === submission.id)?.status).toBe('pending')
    // Activating the finished draft is what approves the submission.
    await updateWord(word.entry.id, { active: true, entry: { ...word.entry, meaning: { hr: 'dovršeno značenje' }, partOfSpeech: 'imenica' } })
    expect((await listAll()).find(s => s.id === submission.id)).toMatchObject({ status: 'approved', reviewedAt: expect.any(String) })
    expect((await readPublic()).words.find(w => w.id === word.entry.id)?.headword).toBe('promotion test word')
  })

  it('maps a seeded atlas settlement from geonames without name guessing when promoting a submission', async () => {
    expect((await submit({ ...valid, text: 'unmapped catalog promotion', placeId: 'geonames:3194545' })).status).toBe(201)
    const submission = (await listAll()).find(s => s.text === 'unmapped catalog promotion')!
    const response = await request(`/api/review/submissions/${submission.id}/word`, { method: 'POST', secret: SECRET })
    expect(response.status).toBe(201)
    const word = await response.json() as AdminWord
    wordIds.push(word.entry.id)
    expect(word.submissionPlace).toBe('Nemčevec (geonames:3194545)')
    expect(word.entry.variants[0]?.usages).toMatchObject([{ areaId: expect.stringMatching(/^[0-9a-f-]{36}$/), confidence: 'reported' }])
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

  it('projects the daily-word fields publicly and drops words whose stored fields are invalid', async () => {
    const input = wordInput(true)
    input.entry.category = 'house'
    input.entry.note = { hr: 'Zanimljivost', en: 'Fun fact' }
    input.entry.distractors = [{ hr: 'kuća', en: 'house' }, { hr: 'put' }]
    const word = await createWord(input)
    const published = (await readPublic()).words.find(w => w.id === word.entry.id)!
    expect(published.category).toBe('house')
    expect(published.note).toEqual({ hr: 'Zanimljivost', en: 'Fun fact' })
    expect(published.distractors?.map(d => d.hr)).toEqual(['kuća', 'put'])

    const invalid = [{ category: 'cars' }, { note: { hr: 'a'.repeat(1001) } }, { distractors: [{ hr: 'a' }, { hr: 'b' }, { hr: 'c' }, { hr: 'd' }] }, { distractors: [{ hr: 'testno značenje' }] }]
    for (const extra of invalid) {
      const { error } = await db.from('heritage_words').update({ entry: { ...word.entry, ...extra, privateNote: 'secret' } }).eq('id', word.entry.id)
      expect(error).toBeNull()
      expect((await readPublic()).words.some(w => w.id === word.entry.id), JSON.stringify(extra)).toBe(false)
    }
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

  it('bounds the public word query and answers 404 for a submission that does not exist', async () => {
    for (const limit of ['0', '101', '1.5', 'nope']) expect((await request(`/api/heritage/words?limit=${limit}`)).status).toBe(400)
    expect((await request('/api/review/submissions/999999999/word', { method: 'POST', secret: SECRET })).status).toBe(404)
  })

  it('returns one public word by slug, 404 for unknown slugs, and redirect info for slug history', async () => {
    const input = wordInput(true)
    input.entry.headword = 'arhivska riječ'
    input.entry.variants[0]!.form = 'arhivska riječ'
    input.entry.category = 'food'
    const word = await createWord(input)
    const slug = 'arhivska-rijec'
    const newSlug = 'arhivska-rijec-nova'
    expect((await db.from('heritage_words').update({ slug }).eq('id', word.entry.id)).error).toBeNull()
    expect((await readPublic(100)).words.some(w => w.id === word.entry.id && w.slug === slug)).toBe(true)
    const page = await request(`/api/heritage/words/${slug}`)
    expect(page.status).toBe(200)
    const body = await page.json() as { word: { headword: string, slug: string }, related: unknown[] }
    expect(body.word).toMatchObject({ headword: 'arhivska riječ', slug })
    expect(Array.isArray(body.related)).toBe(true)
    expect((await request('/api/heritage/words/nepostojeca-rijec')).status).toBe(404)
    if (fake) {
      fake.seedSlugHistory({ kind: 'word', namespace: '', scope_id: null, slug: 'stara-arhivska', entity_id: word.entry.id })
    } else {
      expect((await db.from('content_slug_history').insert({ kind: 'word', namespace: '', scope_id: null, slug: 'stara-arhivska', entity_id: word.entry.id })).error).toBeNull()
    }
    expect((await db.from('heritage_words').update({ slug: newSlug }).eq('id', word.entry.id)).error).toBeNull()
    const redirect = await request('/api/heritage/words/stara-arhivska')
    expect(redirect.status).toBe(200)
    expect(await redirect.json()).toEqual({ redirect: `/potkalnicko-prigorje/govor/${newSlug}` })
  })

  it('includes public word archive paths in the sitemap', async () => {
    const input = wordInput(true)
    input.entry.headword = 'sitemap riječ'
    input.entry.variants[0]!.form = 'sitemap riječ'
    const word = await createWord(input)
    const slug = 'sitemap-rijec'
    expect((await db.from('heritage_words').update({ slug }).eq('id', word.entry.id)).error).toBeNull()
    const sitemap = await (await fetch('/sitemap.xml')).text()
    expect(sitemap).toContain(`${SITE_URL}/potkalnicko-prigorje/govor`)
    expect(sitemap).toContain(`${SITE_URL}/potkalnicko-prigorje/govor/${slug}`)
  })
})

describe('GET /api/learn/pool', () => {
  it('returns the card pool with short public caching', async () => {
    const response = await request('/api/learn/pool')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('max-age=60')
    const body = await response.json() as { version: number, cards: unknown[], topics: unknown[] }
    expect(body.version).toBe(1)
    expect(Array.isArray(body.cards)).toBe(true)
    expect(Array.isArray(body.topics)).toBe(true)
  })
})

describe('GET /api/heritage/daily', () => {
  it('stays closed before a configured launch day and touches no data', async () => {
    const before = fake?.daily.length
    const response = await request('/api/heritage/daily')
    expect(response.status).toBe(404)
    expect(await response.text()).toContain('not-started')
    if (fake) expect(fake.daily.length).toBe(before)
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
  it('refuses the retired targetRef form of a correction: a correction names its target with targetKind and targetId', async () => {
    const response = await submit({
      ...valid,
      type: 'correction',
      targetRef: 'kalnik-crkva-sv-brcka',
      text: 'Zapis: Crkva sv. Brcka\n\nPredloženi ispravak:\nTitular u izvoru je drugačiji.',
      placeId: null,
      name: null,
      contact: null
    })
    expect(response.status).toBe(400)
    expect((await response.json()).data.issues).toContainEqual({ field: 'targetKind', code: 'required' })
    expect((await listAll()).some(row => row.type === 'correction' && String(row.text).startsWith('Zapis: Crkva sv. Brcka'))).toBe(false)
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

  describe('linked to a word (contributions from the daily word)', () => {
    const usage = (wordId: unknown, extra: Record<string, unknown> = {}) => submit({ ...valid, type: 'word', intent: 'usage', wordId, ...extra })

    it('stores a usage and a variant with the word and intent, and review lists them with the headword', async () => {
      const word = await createWord(wordInput(true))
      expect((await usage(word.entry.id, { text: 'linked usage', name: null })).status).toBe(201)
      expect((await submit({ ...valid, type: 'word', intent: 'variant', wordId: word.entry.id, text: 'linked variant', placeId: null })).status).toBe(201)
      const rows = await listAll()
      expect(rows.find(row => row.text === 'linked usage')).toMatchObject({ wordId: word.entry.id, intent: 'usage', wordHeadword: 'testna riječ', placeId: 'geonames:3194024', status: 'pending' })
      expect(rows.find(row => row.text === 'linked variant')).toMatchObject({ wordId: word.entry.id, intent: 'variant', wordHeadword: 'testna riječ', placeId: null })
      expect(rows.find(row => row.text === 'stored submission')?.wordId ?? null).toBeNull()
    })

    it('leaves an unlinked submission without a word or intent', async () => {
      expect((await submit({ ...valid, text: 'plain submission' })).status).toBe(201)
      expect((await listAll()).find(row => row.text === 'plain submission')).toMatchObject({ wordId: null, intent: null, wordHeadword: null })
    })

    it('answers 400 for an unknown word and stores nothing', async () => {
      for (const intent of ['usage', 'variant']) {
        const response = await submit({ ...valid, type: 'word', intent, wordId: 'no-such-word', text: 'unknown word link' })
        expect(response.status).toBe(400)
        expect((await response.json()).data.issues).toContainEqual(expect.objectContaining({ field: 'wordId', code: 'invalid' }))
      }
      expect((await listAll()).some(row => row.text === 'unknown word link')).toBe(false)
    })

    it('answers 400 for a word that is not active, including a withdrawn one', async () => {
      const draft = await createWord(wordInput(false))
      const response = await usage(draft.entry.id, { text: 'draft word link' })
      expect(response.status).toBe(400)
      expect((await response.json()).data.issues).toContainEqual(expect.objectContaining({ field: 'wordId', code: 'invalid' }))

      const live = await createWord(wordInput(true))
      expect((await usage(live.entry.id, { text: 'live word link' })).status).toBe(201)
      await updateWord(live.entry.id, { active: false })
      expect((await usage(live.entry.id, { text: 'withdrawn word link' })).status).toBe(400)
      const texts = (await listAll()).map(row => row.text)
      expect(texts).toContain('live word link')
      expect(texts).not.toContain('draft word link')
      expect(texts).not.toContain('withdrawn word link')
    })

    it('requires the place for a usage, with a place message in the response', async () => {
      const word = await createWord(wordInput(true))
      for (const locale of ['hr', 'en']) {
        const response = await usage(word.entry.id, { placeId: null, locale, text: 'usage without place' })
        expect(response.status).toBe(400)
        const issues = (await response.json()).data.issues
        expect(issues).toContainEqual(expect.objectContaining({ field: 'place', code: 'selectPlace', message: expect.any(String) }))
        expect(issues.find((issue: { code: string }) => issue.code === 'selectPlace').message).toBe(locale === 'en' ? 'Select the place where this is said.' : 'Odaberi mjesto gdje se tako govori.')
      }
      expect((await listAll()).some(row => row.text === 'usage without place')).toBe(false)
    })

    it('rejects an intent without a word, a malformed word id and an unknown intent', async () => {
      expect((await submit({ ...valid, intent: 'usage', text: 'intent only' })).status).toBe(400)
      expect((await usage('bad id!', { text: 'bad word id' })).status).toBe(400)
      expect((await submit({ ...valid, intent: 'confirm', wordId: 'x', text: 'bad intent' })).status).toBe(400)
      const texts = (await listAll()).map(row => row.text)
      for (const text of ['intent only', 'bad word id', 'bad intent']) expect(texts).not.toContain(text)
    })

    it('still drops a honeypot submission silently and still rate limits linked submissions', async () => {
      const word = await createWord(wordInput(true))
      const dropped = await usage(word.entry.id, { text: 'linked honeypot', website: 'https://spam.example' })
      expect(dropped.status).toBe(201)
      expect((await listAll()).some(row => row.text === 'linked honeypot')).toBe(false)
      // The honeypot answer is given before any word lookup, so a bot learns nothing about word ids.
      expect((await usage('no-such-word', { text: 'linked honeypot unknown', website: 'x' })).status).toBe(201)

      const ip = newClient()
      for (let i = 0; i < RATE_LIMIT_MAX; i++) expect((await submit({ ...valid, type: 'word', intent: 'usage', wordId: word.entry.id, text: `linked rate ${i}` }, ip)).status).toBe(201)
      expect((await submit({ ...valid, type: 'word', intent: 'usage', wordId: word.entry.id, text: 'linked rate over' }, ip)).status).toBe(429)
      expect((await listAll()).some(row => row.text === 'linked rate over')).toBe(false)
    })

    it('does not turn a usage confirmation into a new word draft, but still promotes a variant', async () => {
      const word = await createWord(wordInput(true))
      await usage(word.entry.id, { text: 'usage not promotable' })
      await submit({ ...valid, type: 'word', intent: 'variant', wordId: word.entry.id, text: 'variant promotable', placeId: null })
      const rows = await listAll()
      const usageRow = rows.find(row => row.text === 'usage not promotable')!
      expect((await request(`/api/review/submissions/${usageRow.id}/word`, { method: 'POST', secret: SECRET })).status).toBe(400)
      const variantRow = rows.find(row => row.text === 'variant promotable')!
      const promoted = await request(`/api/review/submissions/${variantRow.id}/word`, { method: 'POST', secret: SECRET })
      expect(promoted.status).toBe(201)
      wordIds.push((await promoted.json() as AdminWord).entry.id)
    })
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

describe('admin and review API guard', () => {
  const apiRoot = fileURLToPath(new URL('../server/api/', import.meta.url))

  // Every route file under server/api/admin and server/api/review, as a method and a sample path.
  async function adminRoutes() {
    const files = (await readdir(apiRoot, { recursive: true }))
      .map(file => file.replaceAll('\\', '/'))
      .filter(file => /^(admin|review)\//.test(file) && file.endsWith('.ts') && !/^admin\/session\./.test(file))
    return files.map((file) => {
      const [, route, method] = /^(.*?)(?:\.(get|post|put|patch|delete))?\.ts$/.exec(file)!
      return { file, method: (method ?? 'get').toUpperCase(), path: `/api/${route!.replace(/\/?index$/, '').replace(/\[[^\]]+\]/g, 'test')}` }
    })
  }

  it('answers 401 without a session or secret on every admin and review route', async () => {
    const routes = await adminRoutes()
    expect(routes.map(route => route.file)).toEqual(expect.arrayContaining([
      'admin/content/[kind]/index.get.ts', 'admin/content/[kind]/[id].delete.ts', 'admin/lookup/[kind].get.ts', 'review/submissions.get.ts'
    ]))
    for (const route of routes) {
      const body = route.method === 'GET' || route.method === 'DELETE' ? undefined : {}
      expect((await request(route.path, { method: route.method, body })).status, `${route.method} ${route.path}`).toBe(401)
    }
  })

  it('also guards an encoded spelling of a protected path', async () => {
    expect((await request('/api/%61dmin/content/source')).status).toBe(401)
    expect((await request('/api/admin/content/source', { headers: { cookie: 'admin-session=forged' } })).status).toBe(401)
  })

  it('refuses a cross-site or non-JSON write even with the secret, and changes nothing', async () => {
    await submit({ ...valid, text: 'guarded submission' })
    const { id } = (await listAll()).find(row => row.text === 'guarded submission')!
    const path = `/api/review/submissions/${id}`

    const crossSite = await request(path, { method: 'PATCH', body: { status: 'approved' }, secret: SECRET, headers: { origin: 'https://evil.example' } })
    expect(crossSite.status).toBe(403)
    const formPost = await fetch(path, {
      method: 'PATCH',
      headers: { 'authorization': `Bearer ${SECRET}`, 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': newClient() },
      body: 'status=approved'
    })
    expect(formPost.status).toBe(415)
    expect((await listAll()).find(row => row.id === id)).toMatchObject({ status: 'pending' })

    const host = new URL(url('/')).host
    expect((await request(path, { method: 'PATCH', body: { status: 'approved' }, secret: SECRET, headers: { origin: `http://${host}` } })).status).toBe(200)
    expect((await listAll()).find(row => row.id === id)).toMatchObject({ status: 'approved' })
  })

  it('refuses a cross-site login', async () => {
    const response = await request('/api/admin/session', { method: 'POST', body: { password: SECRET }, headers: { origin: 'https://evil.example' } })
    expect(response.status).toBe(403)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('answers 404 for an unknown content kind or a non-UUID id once authenticated', async () => {
    expect((await request('/api/admin/content/sources', { secret: SECRET })).status).toBe(404)
    expect((await request('/api/admin/content/source/registar-kulturnih-dobara', { secret: SECRET })).status).toBe(404)
    expect((await request('/api/admin/lookup/nope', { secret: SECRET })).status).toBe(404)
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
    // A structured correction needs the signed form token of a real form, so the row is written directly.
    const inserted = await db.from('heritage_submissions').insert({
      text: 'type filter correction row', type: 'correction', target_kind: 'heritage_item', target_id: contentUuid('heritage_item:kalnik-crkva-sv-brcka'),
      payload: { name: 'Crkva sv. Brcka (ispravak)' }, consent_publish: true, consent_version: '2026-11-02', locale: 'hr'
    })
    expect(inserted.error).toBeNull()
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
    const publicDir = resolve(useTestContext().options.nuxtConfig.nitro!.output!.dir!, 'public')
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

describe('atlas SSR pages', () => {
  it('serves every prerendered atlas route with 200', async () => {
    for (const path of atlasPrerenderRoutes as string[]) {
      expect((await fetch(path)).status, path).toBe(200)
    }
  })

  it('keeps SEO on a heritage item page', async () => {
    const path = '/potkalnicko-prigorje/bastina/kalnik/crkva-sv-brcka'
    const item = heritageItemByRoute('kalnik', 'crkva-sv-brcka')!
    const html = await (await fetch(path)).text()
    expect(metaContent(html, 'og:title')).toBe(`${item.name} · Potkalnički zapisi`)
    expect(metaContent(html, 'robots')).toBe('index, follow')
    expect(html).toContain('data-testid="verification-badge-unverified"')
  })
})

describe('public discovery, sharing metadata and error pages', () => {
  it('publishes only public localized routes in the sitemap and blocks private routes in robots.txt', async () => {
    const sitemap = await (await fetch('/sitemap.xml')).text()
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])
    const noindexPaths = new Set(getAtlas().heritage
      .filter(item => item.noindex && item.settlementCode)
      .map(item => `/potkalnicko-prigorje/bastina/${settlementByCode(item.settlementCode!)!.slug}/${item.slug}`))
    const content = buildPublicContent(fakeContentRows(), {})
    const { data: wordRows } = await db.from('heritage_words').select('slug,updated_at').eq('active', true).not('slug', 'is', null)
    const wordEntries = (wordRows ?? [])
      .filter(row => row.slug)
      .map(row => ({ slug: String(row.slug), updatedAt: String(row.updated_at ?? new Date().toISOString()) }))
    const expected = sitemapEntries(content, wordEntries)
      .map(entry => SITE_URL + entry.path)
    expect(urls.sort()).toEqual(expected.sort())
    expect(expected).toEqual([
      'https://karlo-siladi.from.hr/',
      'https://karlo-siladi.from.hr/en',
      'https://karlo-siladi.from.hr/potkalnicko-prigorje/govor',
      'https://karlo-siladi.from.hr/potkalnicko-prigorje/osobe',
      ...wordEntries.map(w => `https://karlo-siladi.from.hr/potkalnicko-prigorje/govor/${w.slug}`),
      ...atlasPrerenderRoutes.filter(path => !noindexPaths.has(path)).map(path => `https://karlo-siladi.from.hr${path}`)
    ].sort())
    expect(sitemap).not.toContain('/heritage')
    expect(sitemap).not.toContain('/en/potkalnicko-prigorje')

    const robots = await (await fetch('/robots.txt')).text()
    for (const path of ['/admin', '/api/']) {
      expect(robots).toContain(`Disallow: ${path}`)
    }
    expect(robots).toContain('Sitemap: https://karlo-siladi.from.hr/sitemap.xml')
  })

  it('does not keep a static sitemap.xml in public/', async () => {
    await expect(readFile(fileURLToPath(new URL('../public/sitemap.xml', import.meta.url)), 'utf8')).rejects.toThrow()
  })

  it.each([
    { path: '/', title: 'Karlo Siladi', description: 'Karlo Siladi izrađuje stvari', image: 'share-hr.jpg' },
    { path: '/en', title: 'Karlo Siladi', description: 'Karlo Siladi builds things', image: 'share-en.jpg' },
    { path: '/potkalnicko-prigorje', title: 'Potkalnički zapisi', description: 'Istraži mjesta', image: 'og.svg' },
    { path: '/potkalnicko-prigorje/igre', title: 'Igraj · Potkalnički zapisi', description: 'Izazovi prijatelja', image: 'og.svg' },
    { path: '/potkalnicko-prigorje/doprinesi', title: 'Doprinesi · Potkalnički zapisi', description: 'Sve što pošalješ', image: 'og.svg' },
    { path: '/potkalnicko-prigorje/o-projektu', title: 'O projektu · Potkalnički zapisi', description: 'digitalni zavičajni atlas', image: 'og.svg' },
    { path: '/potkalnicko-prigorje/uci', title: 'Uči · Potkalnički zapisi', description: 'Odaberi teme', image: 'og.svg' },
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
    expect(html).toContain('2. studenoga 2026.')
  })

  it('describes the games, device storage and word-linked contributions on the privacy notice', async () => {
    const html = await (await fetch('/potkalnicko-prigorje/privatnost', { headers: { accept: 'text/html' } })).text()
    expect(html).toContain('Igre i podaci na uređaju')
    expect(html).toContain('samo u tvom pregledniku')
    expect(html).toContain('povezan s riječju na koju se odnosi')
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
  { method: 'POST', path: '/api/review/submissions/1/word' },
  { method: 'GET', path: '/api/review/daily' },
  { method: 'PUT', path: '/api/review/daily/2099-01-01', body: { wordId: 'anything' } },
  { method: 'DELETE', path: '/api/review/daily/2099-01-01' }
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
    expect((await request('/api/heritage/daily')).status).toBe(503)
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

describe('public atlas API', () => {
  it('refuses invalid parameters before reading content', async () => {
    for (const path of [
      '/api/content/target?kind=word&id=x',
      '/api/content/target?kind=heritage_item',
      `/api/content/target?id=${'a'.repeat(201)}`,
      '/api/atlas/heritage?municipality=a&municipality=b'
    ]) {
      expect((await request(path)).status, path).toBe(400)
    }
  })

  // The fake database serves the atlas seed through the same snapshot loader as production.
  it.skipIf(real)('serves the atlas API from the fake content tables', async () => {
    for (const path of ['/api/atlas/overview', '/api/atlas/heritage', '/api/atlas/settlements/apatovec', '/api/content/target?id=kalnik-crkva-sv-brcka']) {
      const response = await request(path)
      expect(response.status, path).toBe(200)
      expect(response.headers.get('cache-control'), path).toBe('public, max-age=60, stale-while-revalidate=300')
    }
  })

  it.runIf(real)('serves the imported atlas with a short public cache', async () => {
    const response = await request('/api/atlas/overview')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=60, stale-while-revalidate=300')
    expect((await response.json()).municipalities.map((m: { label: string }) => m.label)).toContain('Grad Križevci')
    expect(await (await request('/api/atlas/heritage/krizevci/crkva-sv-ane')).json()).toMatchObject({ item: { ref: 'krizevci-crkva-sv-ane' } })
    expect((await request('/api/atlas/settlements/ne-postoji')).status).toBe(404)
  })
})
