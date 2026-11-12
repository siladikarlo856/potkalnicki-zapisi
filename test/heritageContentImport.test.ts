import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { datasetIssues, IMPORT_IMAGE_LICENSES } from '../scripts/heritage-content/plan.mjs'
import { runImport } from '../scripts/heritage-content/run.mjs'
import { IMAGE_LICENSES } from '../shared/utils/content/heritageImage'
import { validateHeritageItem } from '../shared/utils/content/heritageItem'
import { validateSource } from '../shared/utils/content/source'
import churches from '../data/heritage-content/churches.json'

// The heritage content import (scripts/import-heritage-content.mjs) run against an in-memory copy of the admin API
// and of Commons. The fake admin API saves only what the app's own validators accept, so these runs also prove
// that every write the import sends would be accepted by the real routes.

const BASE = 'https://atlas.test'
const SECRET = 'review-secret-for-tests'
const CATEGORY = 'cb2f662f-3359-8378-b5f3-448d25991ec6'
const MUNICIPALITY = '92140ed6-6420-81d0-8661-91ce0c257f5f'
const JPEG = Buffer.from('ffd8ffe000104a46494600', 'hex')

type Entity = Record<string, unknown> & { id: string, revision: number, settlementSlug: string }
interface CommonsFile { sha1: string, license: string, width: number, height: number }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function fakeSite({ items, sources = [], commons = {} }: { items: Entity[], sources?: Entity[], commons?: Record<string, CommonsFile> }) {
  const state = { items: new Map(items.map(item => [item.id, structuredClone(item)])), sources: new Map(sources.map(source => [source.id, structuredClone(source)])) }
  const calls: string[] = []
  const uploads: unknown[] = []
  const list = (rows: Entity[], url: URL) => {
    const size = Number(url.searchParams.get('size'))
    const page = Number(url.searchParams.get('page'))
    return json({ rows: rows.slice((page - 1) * size, page * size), total: rows.length, page, size })
  }
  const fetchImpl = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const method = init.method ?? 'GET'
    calls.push(`${method} ${url.host}${url.pathname}`)
    if (url.host === 'commons.wikimedia.org') {
      const title = url.searchParams.get('titles')!
      const file = commons[title]
      if (!file) return json({ query: { pages: [{ title, missing: true }] } })
      const side = Number(url.searchParams.get('iiurlwidth'))
      const scale = Math.min(1, side / Math.max(file.width, file.height))
      return json({ query: { pages: [{ title, imageinfo: [{
        sha1: file.sha1, mime: 'image/jpeg', width: file.width, height: file.height,
        thumburl: `https://upload.wikimedia.org/${side}px-${encodeURIComponent(title)}`,
        thumbwidth: Math.round(file.width * scale), thumbheight: Math.round(file.height * scale),
        extmetadata: { License: { value: file.license } }
      }] }] } })
    }
    if (url.host === 'upload.wikimedia.org') return new Response(JPEG, { headers: { 'content-type': 'image/jpeg' } })
    if (url.origin !== BASE) throw new Error(`unexpected request ${url}`)
    if ((init.headers as Record<string, string>).authorization !== `Bearer ${SECRET}`) return json({ statusMessage: 'Unauthorized' }, 401)
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    const path = url.pathname
    if (method === 'GET' && path === '/api/admin/content/heritage_item') return list([...state.items.values()], url)
    if (method === 'GET' && path === '/api/admin/content/source') return list([...state.sources.values()], url)
    const item = /^\/api\/admin\/content\/heritage_item\/(.+)$/.exec(path)
    if (item && method === 'GET') return json({ entity: state.items.get(item[1]!) })
    if (item && method === 'PATCH') {
      const current = state.items.get(item[1]!)!
      if (body.revision !== current.revision) return json({ statusMessage: 'Conflict' }, 409)
      const { revision: _revision, ...changes } = body
      const merged = { ...current, ...changes }
      const { issues } = validateHeritageItem(merged)
      if (issues.length) return json({ statusMessage: 'Invalid', data: { issues } }, 400)
      const missing = (merged.sourceIds as string[]).filter(id => !state.sources.has(id))
      if (missing.length) return json({ statusMessage: 'Invalid', data: { message: `unknown sources ${missing}` } }, 400)
      const saved = { ...merged, revision: current.revision + 1 }
      state.items.set(current.id, saved)
      return json({ entity: saved })
    }
    if (method === 'POST' && path === '/api/admin/content/source') {
      const { value, issues } = validateSource(body)
      if (issues.length) return json({ statusMessage: 'Invalid', data: { issues } }, 400)
      const entity = { ...value, id: randomUUID(), revision: 1, settlementSlug: '' }
      state.sources.set(entity.id, entity)
      return json({ entity }, 201)
    }
    if (method === 'POST' && path === '/api/admin/images') {
      uploads.push(body)
      const name = randomUUID()
      return json({ path: `heritage/${name}.jpg`, thumbPath: `heritage/${name}-thumb.jpg`, width: 1600, height: 1200 })
    }
    return json({ statusMessage: 'Not found' }, 404)
  }
  return { state, calls, uploads, fetchImpl }
}

function heritageItem(settlementSlug: string, slug: string, name: string, overrides: Record<string, unknown> = {}): Entity {
  return {
    id: randomUUID(), revision: 1, settlementSlug, slug, name, categoryId: CATEGORY, municipalityId: MUNICIPALITY,
    settlementId: randomUUID(), locality: null, verification: 'unverified', heritageStatus: 'needs_verification',
    registryNumber: null, period: null, description: null, researchNotes: '', latitude: null, longitude: null,
    noindex: false, sourceIds: [], images: [], status: 'published', ...overrides
  }
}

const SHA1 = 'a'.repeat(40)
const sample = {
  sources: {
    'registar-z-1': { title: 'Registar kulturnih dobara RH: Z-1 Crkva sv. Ane', type: 'official_registry', url: 'https://registar.kulturnadobra.hr/#/details/Z-1' },
    'hrwiki-ana': { title: 'Wikipedija: Crkva sv. Ane', type: 'website', url: 'https://hr.wikipedia.org/w/index.php?oldid=1' }
  },
  items: [{
    key: 'krizevci/crkva-sv-ane',
    name: 'Crkva sv. Ane',
    description: 'Crkva sv. Ane u Križevcima nekadašnja je pavlinska crkva.',
    period: '1699.–1741.',
    registryNumber: 'Z-1',
    heritageStatus: 'protected',
    researchNotes: ['Provjeriti godinu posvete.'],
    sources: ['registar-z-1', 'hrwiki-ana'],
    photo: {
      commonsFile: 'File:Saint Anna - Krizevci.jpg', sha1: SHA1, alt: 'Pročelje i zvonik crkve sv. Ane', caption: null,
      author: 'Andres rus', authorUrl: null, license: 'cc-by-sa-3.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Saint_Anna_-_Krizevci.jpg'
    }
  }],
  notesOnly: [{ key: 'apatovec/kapela-sv-petra', name: 'Kapela sv. Petra', researchNotes: ['Moguće je da je to isti objekt kao Crkva sv. Petra u Apatovcu.'] }]
}
const sampleCommons = { 'File:Saint Anna - Krizevci.jpg': { sha1: SHA1, license: 'cc-by-sa-3.0', width: 3240, height: 4320 } }

function sampleSite(overrides: Record<string, unknown> = {}, commons = sampleCommons) {
  return fakeSite({
    items: [heritageItem('krizevci', 'crkva-sv-ane', 'Crkva sv. Ane', overrides), heritageItem('apatovec', 'kapela-sv-petra', 'Kapela sv. Petra')],
    commons
  })
}

const writes = (calls: string[]) => calls.filter(call => !call.startsWith('GET '))

describe('heritage content import', () => {
  it('reads only on a dry run and reports what it would change', async () => {
    const site = sampleSite()
    const lines: string[] = []
    const { report } = await runImport({ dataset: sample, base: BASE, secret: SECRET, fetchImpl: site.fetchImpl, log: line => lines.push(line) })
    expect(writes(site.calls)).toEqual([])
    expect(report.map(entry => [entry.key, entry.status])).toEqual([['krizevci/crkva-sv-ane', 'would update'], ['apatovec/kapela-sv-petra', 'would update']])
    expect(report[0]!.changes).toEqual([
      'description: set', 'period: set', 'registryNumber: set', 'heritageStatus: needs_verification → protected',
      'researchNotes: +1', 'sources: +2', 'photo: +1 (main photo)'
    ])
    expect(lines.at(-1)).toMatch(/Nothing was written/)
  })

  it('applies the record through the admin API, then changes nothing on a second run', async () => {
    const site = sampleSite({ researchNotes: 'Pavlinski sklop.' })
    await runImport({ dataset: sample, base: BASE, secret: SECRET, apply: true, fetchImpl: site.fetchImpl })
    const ana = [...site.state.items.values()].find(item => item.slug === 'crkva-sv-ane')!
    expect(ana).toMatchObject({
      description: sample.items[0]!.description, period: '1699.–1741.', registryNumber: 'Z-1', heritageStatus: 'protected',
      researchNotes: 'Pavlinski sklop. Provjeriti godinu posvete.', revision: 2
    })
    expect((ana.sourceIds as string[]).map(id => site.state.sources.get(id)!.url)).toEqual([sample.sources['registar-z-1'].url, sample.sources['hrwiki-ana'].url])
    expect(ana.images).toEqual([expect.objectContaining({
      alt: 'Pročelje i zvonik crkve sv. Ane', author: 'Andres rus', license: 'cc-by-sa-3.0', sourceUrl: sample.items[0]!.photo.sourceUrl,
      path: expect.stringMatching(/^heritage\/.+\.jpg$/)
    })])
    expect(site.uploads).toEqual([{ image: JPEG.toString('base64'), thumb: JPEG.toString('base64') }])
    expect(writes(site.calls).filter(call => call.includes('/content/source'))).toHaveLength(2)

    const before = site.calls.length
    const { report } = await runImport({ dataset: sample, base: BASE, secret: SECRET, apply: true, fetchImpl: site.fetchImpl })
    expect(report.map(entry => entry.status)).toEqual(['unchanged', 'unchanged'])
    expect(writes(site.calls.slice(before))).toEqual([])
    expect(site.calls.slice(before).some(call => call.includes('upload.wikimedia.org'))).toBe(false)
  })

  it('never overwrites what an editor already wrote', async () => {
    const site = sampleSite({ description: 'Opis urednika.', registryNumber: 'Z-9', heritageStatus: 'historical_site' })
    const { report } = await runImport({ dataset: sample, base: BASE, secret: SECRET, apply: true, fetchImpl: site.fetchImpl })
    const ana = [...site.state.items.values()].find(item => item.slug === 'crkva-sv-ane')!
    expect(ana).toMatchObject({ description: 'Opis urednika.', registryNumber: 'Z-9', heritageStatus: 'historical_site' })
    expect(report[0]!.kept).toEqual([
      'description: stored value kept ("Opis urednika.")', 'registryNumber: stored value kept ("Z-9")', 'heritageStatus: stored "historical_site" kept'
    ])
  })

  it('refuses a photo that changed on Commons since review and still imports the rest', async () => {
    const site = sampleSite({}, { 'File:Saint Anna - Krizevci.jpg': { ...sampleCommons['File:Saint Anna - Krizevci.jpg'], sha1: 'b'.repeat(40) } })
    const { report } = await runImport({ dataset: sample, base: BASE, secret: SECRET, apply: true, fetchImpl: site.fetchImpl })
    expect(report[0]!.problems).toEqual([expect.stringMatching(/photo not added: .*changed on Commons since review/)])
    expect(report[0]!.status).toBe('updated')
    expect(site.uploads).toEqual([])
    expect([...site.state.items.values()].find(item => item.slug === 'crkva-sv-ane')!.description).toBe(sample.items[0]!.description)
  })

  it('reports a record whose item is not on the site, and refuses a bad dataset or secret before writing', async () => {
    const site = fakeSite({ items: [heritageItem('krizevci', 'crkva-sv-ane', 'Crkva sv. Ane')], commons: sampleCommons })
    const { report } = await runImport({ dataset: sample, base: BASE, secret: SECRET, fetchImpl: site.fetchImpl })
    expect(report[1]).toMatchObject({ key: 'apatovec/kapela-sv-petra', status: 'not found' })

    const nonFree = { ...sample, items: [{ ...sample.items[0]!, photo: { ...sample.items[0]!.photo, license: 'cc-by-nc-4.0' } }] }
    await expect(runImport({ dataset: nonFree, base: BASE, secret: SECRET, fetchImpl: site.fetchImpl })).rejects.toThrow(/not a free licence/)
    await expect(runImport({ dataset: sample, base: BASE, secret: 'wrong', fetchImpl: site.fetchImpl })).rejects.toThrow(/401/)
    expect(writes(site.calls)).toEqual([])
  })
})

describe('reviewed church dataset (data/heritage-content/churches.json)', () => {
  it('takes only free licences the site accepts', () => {
    expect(IMPORT_IMAGE_LICENSES.every(license => (IMAGE_LICENSES as readonly string[]).includes(license))).toBe(true)
    expect(IMPORT_IMAGE_LICENSES).not.toContain('permission')
  })

  it('is complete and consistent', () => {
    expect(datasetIssues(churches)).toEqual([])
    expect(churches.items).toHaveLength(29)
    for (const source of Object.values(churches.sources)) expect(validateSource(source).issues).toEqual([])
  })

  it('imports every record into a site holding the inventory, as the admin API accepts it', async () => {
    const records = [...churches.items, ...churches.notesOnly]
    const site = fakeSite({
      items: records.map(record => heritageItem(record.key.split('/')[0]!, record.key.split('/')[1]!, record.name)),
      commons: Object.fromEntries(churches.items.filter(record => record.photo).map(record => [record.photo!.commonsFile, {
        sha1: record.photo!.sha1, license: record.photo!.license, width: 4608, height: 3456
      }]))
    })
    const { report } = await runImport({ dataset: churches, base: BASE, secret: SECRET, apply: true, fetchImpl: site.fetchImpl })
    expect(report.filter(entry => entry.status !== 'updated')).toEqual([])
    const saved = [...site.state.items.values()]
    expect(saved.filter(item => item.description).length).toBe(churches.items.filter(record => record.description).length)
    expect(saved.filter(item => (item.images as unknown[]).length).length).toBe(churches.items.filter(record => record.photo).length)
  })
})
