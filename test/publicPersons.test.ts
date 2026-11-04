import { describe, expect, it } from 'vitest'
import { buildPublicContent, loadPublicContentRows } from '../server/utils/publicContent'
import {
  contentTarget,
  heritageItemDetail,
  municipalityPage,
  personDetail,
  personList,
  resolvePerson,
  settlementPage
} from '../server/utils/publicAtlas'
import { sitemapEntries } from '../server/utils/sitemap'
import { exactIsoDate, personJsonLd } from '../shared/utils/personJsonLd'
import { PERSON_IDS, fakePersonRows, fakeRowsWithPersons } from './helpers/fakePersons'

// Persons in the public snapshot and its queries, without a database: live and gone rules, reverse maps,
// the person API shapes, the sitemap and the structured data. test/persons.integration.test.ts covers the tables.
const content = buildPublicContent(fakeRowsWithPersons(), {})
const id = PERSON_IDS

describe('persons in the public snapshot', () => {
  it('keeps published persons with a live area and drops the rest', () => {
    expect(content.persons.map(p => p.slug)).toEqual(['ana-gradska', 'anja-skrivena', 'ivan-kalnican'])
    expect(content.personBySlug.has('vanjska-osoba')).toBe(false)
    expect(content.personById.get(id.live)?.name).toBe('Ivan Kalničan')
  })

  it('marks archived persons gone, by slug and by id', () => {
    expect(content.gone.persons.has('stara-osoba')).toBe(true)
    expect(content.gone.ids.has(id.archived)).toBe(true)
    expect(content.personBySlug.has('stara-osoba')).toBe(false)
  })

  it('never shows a non-published row (the loader only reads published and archived)', () => {
    const rows = fakeRowsWithPersons()
    rows.persons = [...rows.persons!, { ...rows.persons![0]!, id: '00000000-0000-4000-8000-000000000b01', slug: 'nacrt', status: 'draft' as 'published' }]
    const built = buildPublicContent(rows, {})
    expect(built.personBySlug.has('nacrt')).toBe(false)
    expect(built.gone.persons.has('nacrt')).toBe(true)
  })

  it('goes offline with its only area, and keeps only live links', () => {
    const person = content.personById.get(id.live)!
    expect(person.areaLinks).toEqual([
      { areaId: id.kalnikSettlement, role: 'rodjen' },
      { areaId: id.kalnikSettlement, role: 'umro' }
    ])
    expect(person.itemLinks).toEqual([{ itemId: id.church, relation: 'kapela mu je posvećena' }])
    expect(person.sourceIds).toEqual([id.source])

    const rows = fakeRowsWithPersons()
    rows.areas = rows.areas.map(a => a.id === id.kalnikSettlement ? { ...a, status: 'archived' as const } : a)
    expect(buildPublicContent(rows, {}).personBySlug.has('ivan-kalnican')).toBe(false)
  })

  it('builds the reverse maps', () => {
    expect(content.personsByArea.get(id.kalnikSettlement)).toEqual([id.live])
    expect(content.personsByArea.get(id.kalnikMunicipality)).toEqual([id.noindex])
    expect(content.personsByItem.get(id.church)).toEqual([id.live])
  })

  it('never carries research notes or clues into the public shapes', () => {
    const rows = fakeRowsWithPersons()
    rows.persons = rows.persons!.map(p => ({ ...p, research_notes: 'PRIVATNA-BILJESKA', clue: 'PRIVATNA-NAPOMENA' }))
    const built = buildPublicContent(rows, {})
    const everything = JSON.stringify([
      built.persons,
      [...built.persons].map(p => personDetail(built, p)),
      personList(built),
      settlementPage(built, built.settlementById.get(id.kalnikSettlement)!)
    ])
    expect(everything).not.toContain('PRIVATNA')
    expect(everything).not.toMatch(/research|clue/i)
  })

  it('does not select private columns from the database', async () => {
    const selects: Record<string, string> = {}
    const empty = { data: [], error: null }
    const query = (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const method of ['in', 'order', 'range']) chain[method] = () => chain
      chain.select = (columns: string) => {
        selects[table] = columns
        return chain
      }
      chain.then = (resolve: (value: typeof empty) => unknown) => resolve(empty)
      return chain
    }
    await loadPublicContentRows({ from: query } as never)
    expect(selects.persons).toBeDefined()
    expect(selects.persons).not.toMatch(/research_notes|clue|search_text|credits/)
    expect(Object.keys(selects)).toEqual(expect.arrayContaining(['person_areas', 'person_heritage_items', 'person_sources']))
  })
})

describe('person queries', () => {
  it('resolves live, moved, gone and unknown slugs', () => {
    expect(resolvePerson(content, 'ivan-kalnican').status).toBe('ok')
    expect(resolvePerson(content, 'ivan-stari')).toEqual({ status: 'redirect', path: '/potkalnicko-prigorje/osobe/ivan-kalnican' })
    expect(resolvePerson(content, 'stara-osoba')).toEqual({ status: 'gone' })
    expect(resolvePerson(content, 'vanjska-osoba')).toEqual({ status: 'not_found' })
    expect(resolvePerson(content, 'nitko')).toEqual({ status: 'not_found' })
  })

  it('lists persons with years, place and unit filter options', () => {
    const list = personList(content)!
    expect(list.total).toBe(3)
    const ivan = list.persons.find(p => p.slug === 'ivan-kalnican')!
    expect(ivan).toMatchObject({ years: '1813–1849', role: 'kapelan i pjesnik', place: 'Kalnik', path: '/potkalnicko-prigorje/osobe/ivan-kalnican', municipalitySlugs: ['opcina-kalnik'] })
    expect(list.persons.find(p => p.slug === 'ana-gradska')!.years).toBe('1844–1910')
    expect(list.municipalities.map(m => m.slug)).toEqual(['grad-krizevci', 'opcina-kalnik'])
  })

  it('filters by unit, including persons linked to its settlements', () => {
    expect(personList(content, { municipality: 'opcina-kalnik' })!.persons.map(p => p.slug)).toEqual(['anja-skrivena', 'ivan-kalnican'])
    expect(personList(content, { municipality: 'grad-krizevci' })!.persons.map(p => p.slug)).toEqual(['ana-gradska'])
    expect(personList(content, { municipality: 'opcina-gornja-rijeka' })!.persons).toEqual([])
    expect(personList(content, { municipality: 'nema' })).toBeNull()
  })

  it('shapes the person detail with places by role, heritage, and sources', () => {
    const detail = personDetail(content, content.personById.get(id.live)!)
    expect(detail.ref).toBe(id.live)
    expect(detail.placeGroups).toEqual([
      { role: 'rodjen', label: 'Rođen/a', places: [{ id: id.kalnikSettlement, name: 'Kalnik', path: '/potkalnicko-prigorje/naselja/kalnik' }] },
      { role: 'umro', label: 'Umro/la', places: [{ id: id.kalnikSettlement, name: 'Kalnik', path: '/potkalnicko-prigorje/naselja/kalnik' }] }
    ])
    expect(detail.heritage).toEqual([{
      id: id.church, name: 'Crkva sv. Brcka', path: '/potkalnicko-prigorje/bastina/kalnik/crkva-sv-brcka', relation: 'kapela mu je posvećena', verification: 'unverified'
    }])
    expect(detail.sources.map(s => s.id)).toEqual([id.source])
    expect(detail).toMatchObject({ bornPlace: 'Edde (HU)', diedPlace: 'Križevci', openQuestions: 'Godina smrti 1849. ili 1850.' })
  })

  it('links a unit-level person with a unit path', () => {
    const detail = personDetail(content, content.personById.get(id.noindex)!)
    expect(detail.placeGroups[0]!.places[0]!.path).toBe('/potkalnicko-prigorje/istrazi/opcina-kalnik')
    expect(detail.place).toBe('Općina Kalnik')
  })

  it('adds persons to settlement, unit and item pages', () => {
    const settlement = settlementPage(content, content.settlementById.get(id.kalnikSettlement)!)
    expect(settlement.persons.map(p => p.slug)).toEqual(['ivan-kalnican'])
    const unit = municipalityPage(content, content.municipalityById.get(id.kalnikMunicipality)!)
    expect(unit.persons.map(p => p.slug)).toEqual(['anja-skrivena', 'ivan-kalnican'])
    const item = heritageItemDetail(content, content.itemById.get(id.church)!)
    expect(item.persons.map(p => p.name)).toEqual(['Ivan Kalničan'])
  })

  it('resolves a correction target for a person by UUID', () => {
    const result = contentTarget(content, 'person', id.live)
    expect(result.status).toBe('ok')
    if (result.status === 'ok') expect(result.value).toMatchObject({ kind: 'person', person: { ref: id.live, name: 'Ivan Kalničan' } })
    expect(contentTarget(content, 'person', id.archived).status).toBe('gone')
    expect(contentTarget(content, 'person', '00000000-0000-4000-8000-0000000000ff').status).toBe('not_found')
  })

  it('treats a snapshot without person rows as having none', () => {
    const { persons: _persons, personAreas: _areas, personItems: _items, personSources: _sources, ...bare } = fakeRowsWithPersons()
    const built = buildPublicContent(bare, {})
    expect(built.persons).toEqual([])
    expect(fakePersonRows().persons.length).toBeGreaterThan(0)
  })
})

describe('person sitemap and structured data', () => {
  it('lists /osobe and the live, indexable persons', () => {
    const paths = sitemapEntries(content).map(e => e.path)
    expect(paths).toContain('/potkalnicko-prigorje/osobe')
    expect(paths).toContain('/potkalnicko-prigorje/osobe/ivan-kalnican')
    expect(paths).toContain('/potkalnicko-prigorje/osobe/ana-gradska')
    expect(paths).not.toContain('/potkalnicko-prigorje/osobe/anja-skrivena')
    expect(paths).not.toContain('/potkalnicko-prigorje/osobe/stara-osoba')
    expect(paths).not.toContain('/potkalnicko-prigorje/osobe/vanjska-osoba')
    expect(sitemapEntries(content).find(e => e.path.endsWith('ivan-kalnican'))!.lastmod).toBe('2026-11-02')
  })

  it.each([
    ['14. 1. 1813.', '1813-01-14'],
    ['7. 9. 1619', '1619-09-07'],
    ['1884.', '1884'],
    ['oko 1588.', undefined],
    ['1405. ili 1408.', undefined],
    ['31. 2. 13.', undefined],
    ['', undefined],
    [null, undefined]
  ])('reads %j as %j', (text, expected) => {
    expect(exactIsoDate(text)).toBe(expected)
  })

  it('builds Person JSON-LD with exact dates and source URLs only', () => {
    const ld = personJsonLd(personDetail(content, content.personById.get(id.live)!), 'https://example.com/osobe/ivan-kalnican')
    expect(ld).toMatchObject({ '@type': 'Person', 'name': 'Ivan Kalničan', 'birthDate': '1813-01-14', 'deathDate': '1849-09-05', 'sameAs': ['https://registar.kulturnadobra.hr/'] })
    const rough = personJsonLd({ ...personDetail(content, content.personById.get(id.live)!), born: 'oko 1588.', died: '1405. ili 1408.', sources: [] }, 'https://example.com/x')
    expect(rough).not.toHaveProperty('birthDate')
    expect(rough).not.toHaveProperty('deathDate')
    expect(rough).not.toHaveProperty('sameAs')
  })
})
