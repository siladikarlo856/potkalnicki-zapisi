import { randomBytes, randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import municipalities from './fixtures/atlas/municipalities.json'
import settlements from './fixtures/atlas/settlements.json'
import heritage from './fixtures/atlas/heritage.json'
import prerenderRoutes from './fixtures/atlas/prerender-routes.json'
import { createSnapshotStore, loadPublicContent } from '../server/utils/publicContent'
import { contentTarget, personDetail, personList, resolveHeritageItem, resolveMunicipality, resolvePerson, resolveSettlement, settlementPage } from '../server/utils/publicAtlas'
import { sitemapEntries, SITE_URL } from '../server/utils/sitemap'
import { integrationDb } from './support/integrationDb'

// The public read layer on a real Postgres and PostgREST with every migration and the atlas import applied.
// Run with `node scripts/test-challenges.mjs`; skipped everywhere else. The imported atlas is only read here.
// Lifecycle checks (renames, moves, archiving, drafts) use their own region and places, so the scope of the
// real region Potkalničko prigorje, which other suites count, never changes.
const db = await integrationDb()
const { sql } = db
const service = db.service
const routable = (prerenderRoutes as string[]).filter(path => /\/(istrazi|naselja|bastina)\/./.test(path))

describe.skipIf(!db.enabled)('public read layer on Postgres', () => {
  it('serves the whole imported atlas', async () => {
    const content = await loadPublicContent(service)
    expect(content.region).toMatchObject({ slug: 'potkalnicko-prigorje', name: 'Potkalničko prigorje' })
    const imported = (kind: string, key: string) => content.legacyIds.get(`${kind}:${key}`)!

    expect(content.municipalities.map(m => m.label).sort()).toEqual(municipalities.map(m => m.name).sort())
    for (const m of municipalities) expect(content.municipalityById.get(imported('area', m.id)), m.id).toMatchObject({ slug: m.slug, label: m.name })
    for (const s of settlements) {
      expect(content.settlementById.get(imported('area', s.id)), s.id).toMatchObject({
        slug: s.slug, name: s.name, code: s.id, municipalityId: imported('area', s.municipalityId), centroid: s.centroid
      })
    }
    for (const h of heritage) {
      const item = content.itemById.get(imported('heritage_item', h.id))!
      expect(item, h.id).toMatchObject({
        ref: h.id, slug: h.slug, name: h.name, noindex: h.noindex, verification: h.status, researchNotes: h.researchNotes,
        locality: 'locality' in h ? h.locality : null, settlementId: h.settlementCode ? imported('area', h.settlementCode) : null,
        sourceIds: h.sourceIds.map(id => imported('source', id))
      })
      expect(content.categories.get(item.categoryId)!.key, h.id).toBe(h.category)
      // Old correction links (`?zapis=<old id>`, with or without diacritics) find the same item.
      expect(contentTarget(content, 'heritage_item', h.legacyId), h.legacyId).toMatchObject({ status: 'ok', value: { item: { id: item.id, ref: h.id } } })
    }
  })

  it('resolves every prerendered atlas route of the JSON era', async () => {
    const content = await loadPublicContent(service)
    expect(routable).toHaveLength(235)
    for (const path of routable) {
      const [, section, a, b] = path.split('/')
      const result = section === 'istrazi'
        ? resolveMunicipality(content, a!)
        : section === 'naselja' ? resolveSettlement(content, a!) : resolveHeritageItem(content, a!, b!)
      expect(result.status, path).toBe('ok')
    }
  })

  it('builds the same sitemap URLs as the in-memory atlas snapshot', async () => {
    const content = await loadPublicContent(service)
    const expected = sitemapEntries(content).map(e => SITE_URL + e.path).sort()
    expect(expected.length).toBeGreaterThan(200)
    expect(expected.every(url => url.startsWith(SITE_URL))).toBe(true)
    expect(sitemapEntries(content).filter(e => e.lastmod).every(e => /^\d{4}-\d{2}-\d{2}$/.test(e.lastmod!))).toBe(true)
  })

  it('follows renames, moves, archiving and drafts of its own places', async () => {
    const tag = randomBytes(4).toString('hex')
    const region = `test-${tag}`
    const id = { region: randomUUID(), m: randomUUID(), a: randomUUID(), b: randomUUID(), item: randomUUID(), draft: randomUUID() }
    const load = () => loadPublicContent(service, { regionSlug: region })
    sql(`
      insert into public.areas (id, kind, parent_id, name, slug, status) values
        ('${id.region}', 'region', public.content_uuid('area:hr-kkz'), 'Test ${tag}', '${region}', 'published'),
        ('${id.m}', 'municipality', public.content_uuid('area:hr-kkz'), 'Testna ${tag}', 'opcina-${tag}', 'published');
      insert into public.areas (id, kind, parent_id, name, slug, status) values
        ('${id.a}', 'settlement', '${id.m}', 'Prvo ${tag}', 'prvo-${tag}', 'published'),
        ('${id.b}', 'settlement', '${id.m}', 'Drugo ${tag}', 'drugo-${tag}', 'published');
      insert into public.area_regions (area_id, region_id) values ('${id.m}', '${id.region}');
      insert into public.heritage_items (id, name, slug, category_id, municipality_id, settlement_id, status) values
        ('${id.item}', 'Kapela ${tag}', 'kapela', public.content_uuid('heritage_category:chapel'), '${id.m}', '${id.a}', 'published'),
        ('${id.draft}', 'Skica ${tag}', 'skica', public.content_uuid('heritage_category:chapel'), '${id.m}', '${id.a}', 'draft');
      insert into public.heritage_item_sources (item_id, source_id, position) values
        ('${id.item}', public.content_uuid('source:registar-kulturnih-dobara'), 0);`)

    let content = await load()
    expect(content.municipalities.map(m => m.label)).toEqual([`Općina Testna ${tag}`])
    expect(content.settlements.map(s => s.id).sort()).toEqual([id.a, id.b].sort())
    expect(content.items.map(i => [i.id, i.ref, i.sourceIds.length])).toEqual([[id.item, id.item, 1]])
    expect(resolveHeritageItem(content, `prvo-${tag}`, 'skica')).toEqual({ status: 'not_found' })
    // Other regions stay out of scope.
    expect(resolveSettlement(content, 'apatovec')).toEqual({ status: 'not_found' })

    sql(`update public.areas set slug = 'prvo-novo-${tag}' where id = '${id.a}';
      update public.heritage_items set slug = 'kapela-nova' where id = '${id.item}';`)
    content = await load()
    const current = `/bastina/prvo-novo-${tag}/kapela-nova`
    expect(resolveSettlement(content, `prvo-${tag}`)).toEqual({ status: 'redirect', path: `/naselja/prvo-novo-${tag}` })
    expect(resolveHeritageItem(content, `prvo-${tag}`, 'kapela')).toEqual({ status: 'redirect', path: current })
    expect(resolveHeritageItem(content, `prvo-novo-${tag}`, 'kapela-nova')).toMatchObject({ status: 'ok' })

    sql(`update public.heritage_items set settlement_id = '${id.b}' where id = '${id.item}';`)
    content = await load()
    expect(resolveHeritageItem(content, `prvo-${tag}`, 'kapela')).toEqual({ status: 'redirect', path: `/bastina/drugo-${tag}/kapela-nova` })

    sql(`update public.heritage_items set status = 'archived' where id = '${id.item}';`)
    content = await load()
    expect(resolveHeritageItem(content, `drugo-${tag}`, 'kapela-nova')).toEqual({ status: 'gone' })
    expect(resolveHeritageItem(content, `prvo-${tag}`, 'kapela')).toEqual({ status: 'gone' })
    expect(contentTarget(content, 'heritage_item', id.item)).toEqual({ status: 'gone' })

    sql(`update public.heritage_items set status = 'published' where id = '${id.item}';
      update public.areas set status = 'archived' where id = '${id.b}';`)
    content = await load()
    expect(resolveSettlement(content, `drugo-${tag}`)).toEqual({ status: 'gone' })
    expect(resolveHeritageItem(content, `drugo-${tag}`, 'kapela-nova')).toEqual({ status: 'gone' })
    expect(content.items).toEqual([])

    sql(`delete from public.area_regions where area_id = '${id.m}';`)
    content = await load()
    expect(content.municipalities).toEqual([])
    expect(resolveMunicipality(content, `opcina-${tag}`)).toEqual({ status: 'not_found' })
  })

  it('serves persons: live rules, old slugs, archiving and no private columns', async () => {
    const tag = randomBytes(4).toString('hex')
    const region = `test-${tag}`
    const id = { region: randomUUID(), m: randomUUID(), a: randomUUID(), item: randomUUID(), person: randomUUID(), draft: randomUUID() }
    const load = () => loadPublicContent(service, { regionSlug: region })
    sql(`
      insert into public.areas (id, kind, parent_id, name, slug, status) values
        ('${id.region}', 'region', public.content_uuid('area:hr-kkz'), 'Test ${tag}', '${region}', 'published'),
        ('${id.m}', 'municipality', public.content_uuid('area:hr-kkz'), 'Testna ${tag}', 'opcina-${tag}', 'published');
      insert into public.areas (id, kind, parent_id, name, slug, status) values
        ('${id.a}', 'settlement', '${id.m}', 'Prvo ${tag}', 'prvo-${tag}', 'published');
      insert into public.area_regions (area_id, region_id) values ('${id.m}', '${id.region}');
      insert into public.heritage_items (id, name, slug, category_id, municipality_id, settlement_id, status) values
        ('${id.item}', 'Kapela ${tag}', 'kapela', public.content_uuid('heritage_category:chapel'), '${id.m}', '${id.a}', 'published');
      insert into public.persons (id, name, slug, role, born_year, died, died_year, research_notes, verification, status) values
        ('${id.person}', 'Osoba ${tag}', 'osoba-${tag}', 'učitelj', 1800, '1870.', 1870, 'PRIVATNO-${tag}', 'unverified', 'published'),
        ('${id.draft}', 'Nacrt ${tag}', 'nacrt-${tag}', '', null, '1900.', 1900, '', 'unverified', 'draft');
      insert into public.person_areas (person_id, area_id, role, position) values
        ('${id.person}', '${id.a}', 'rodjen', 0), ('${id.person}', public.content_uuid('area:hr-kkz'), 'zivio', 1),
        ('${id.draft}', '${id.a}', 'rodjen', 0);
      insert into public.person_heritage_items (person_id, item_id, relation, position) values ('${id.person}', '${id.item}', 'kapela mu je posvećena', 0);
      insert into public.person_sources (person_id, source_id, position) values ('${id.person}', public.content_uuid('source:registar-kulturnih-dobara'), 0);`)

    let content = await load()
    expect(content.persons.map(p => [p.slug, p.areaLinks.length, p.itemLinks.length, p.sourceIds.length])).toEqual([[`osoba-${tag}`, 1, 1, 1]])
    expect(resolvePerson(content, `nacrt-${tag}`)).toEqual({ status: 'not_found' })
    expect(personList(content)!.persons.map(p => p.years)).toEqual(['1800–1870'])
    expect(settlementPage(content, content.settlementById.get(id.a)!).persons.map(p => p.name)).toEqual([`Osoba ${tag}`])
    expect(JSON.stringify([content.persons, personDetail(content, content.persons[0]!)])).not.toContain('PRIVATNO')
    expect(contentTarget(content, 'person', id.person)).toMatchObject({ status: 'ok', value: { kind: 'person', person: { ref: id.person } } })

    sql(`update public.persons set slug = 'osoba-nova-${tag}' where id = '${id.person}';`)
    content = await load()
    expect(resolvePerson(content, `osoba-${tag}`)).toEqual({ status: 'redirect', path: `/osobe/osoba-nova-${tag}` })

    sql(`update public.persons set status = 'archived' where id = '${id.person}';`)
    content = await load()
    expect(content.persons).toEqual([])
    expect(resolvePerson(content, `osoba-nova-${tag}`)).toEqual({ status: 'gone' })
    expect(resolvePerson(content, `osoba-${tag}`)).toEqual({ status: 'gone' })
    expect(contentTarget(content, 'person', id.person)).toEqual({ status: 'gone' })
  })

  it('shows a write on the next request after invalidation', async () => {
    const tag = randomBytes(4).toString('hex')
    const regionId = randomUUID()
    sql(`insert into public.areas (id, kind, parent_id, name, slug, status)
      values ('${regionId}', 'region', public.content_uuid('area:hr-kkz'), 'Prije ${tag}', 'test-${tag}', 'published');`)
    const store = createSnapshotStore({ load: () => loadPublicContent(service, { regionSlug: `test-${tag}` }) })
    expect((await store.get()).region!.name).toBe(`Prije ${tag}`)
    sql(`update public.areas set name = 'Poslije ${tag}' where id = '${regionId}';`)
    expect((await store.get()).region!.name).toBe(`Prije ${tag}`)
    store.invalidate()
    expect((await store.get()).region!.name).toBe(`Poslije ${tag}`)
  })
})
