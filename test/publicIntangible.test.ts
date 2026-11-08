import { describe, expect, it, vi } from 'vitest'
import { buildPublicContent, loadPublicContentRows } from '../server/utils/publicContent'
import {
  intangibleDetail,
  intangibleExcerpt,
  intangibleList,
  narratorPage,
  resolveIntangible,
  resolveNarrator,
  resolveTheme,
  themePage
} from '../server/utils/publicIntangible'
import { municipalityPage, personDetail, resolvePerson, settlementPage } from '../server/utils/publicAtlas'
import { sitemapEntries } from '../server/utils/sitemap'
import { formatRecordedOn, intangibleKindFromSlug, periodLabel } from '../shared/utils/intangiblePublic'
import { IH, fakeRowsWithIntangible } from './helpers/fakeIntangible'

// Stories, Customs, Folk texts, Narrators and themes in the public snapshot and its queries, without a database:
// what is live and what is gone, the consent rule for narrators, that editor-only fields never reach a response,
// route resolution with slug history, the list filters, the place and person pages and the sitemap.
// test/intangible.integration.test.ts covers the tables.
const content = buildPublicContent(fakeRowsWithIntangible(), {})
const intangible = content.intangible

function everything() {
  const records = intangible.records
  return JSON.stringify([
    intangible.records, intangible.narrators, intangible.themes,
    records.map(r => intangibleDetail(content, r)),
    intangibleList(content),
    intangible.narrators.map(n => narratorPage(content, n)),
    intangible.themes.map(t => themePage(content, t)),
    content.municipalities.map(m => municipalityPage(content, m)),
    content.settlements.map(s => settlementPage(content, s)),
    content.persons.map(p => personDetail(content, p))
  ])
}

describe('intangible heritage in the public snapshot', () => {
  it('keeps published records with a known type and drops the rest', () => {
    expect(intangible.records.map(r => r.slug).sort()).toEqual([
      'kalnicka-vjestica', 'martinje-u-kalniku', 'martinjska-zdravica', 'pjesma-bez-obicaja', 'prica-stare-vrste', 'skrivena-prica'
    ])
    expect(intangible.recordByRoute.has('story/prica-bez-vrste')).toBe(false)
    expect(content.intangible.gone.records.has('story/prica-bez-vrste')).toBe(false)
  })

  it('marks archived records, themes and narrators gone, by slug and by id', () => {
    expect(intangible.gone.records.has('story/skinuta-prica')).toBe(true)
    expect(intangible.gone.records.has('custom/napusteni-obicaj')).toBe(true)
    expect(intangible.gone.themes.has('arhivirana')).toBe(true)
    expect(intangible.gone.narrators.has('stara-kazivacica')).toBe(true)
    for (const archived of [IH.storyArchived, IH.customArchived, IH.themeArchived, IH.narratorArchived]) expect(intangible.gone.ids.has(archived)).toBe(true)
    expect(intangible.recordById.has(IH.storyArchived)).toBe(false)
  })

  it('never shows a draft (the loader only reads published and archived)', () => {
    const rows = fakeRowsWithIntangible()
    rows.intangible!.records.story.push({ ...rows.intangible!.records.story[0]!, id: '00000000-0000-4000-8000-000000000b02', slug: 'nacrt', status: 'draft' as 'published' })
    const built = buildPublicContent(rows, {})
    expect(built.intangible.recordByRoute.has('story/nacrt')).toBe(false)
    expect(built.intangible.gone.records.has('story/nacrt')).toBe(true)
  })

  it('labels a record with an archived type but leaves that type out of the filters', () => {
    expect(intangible.recordByRoute.has('story/prica-stare-vrste')).toBe(true)
    expect(intangibleList(content, { kind: 'prica' })!.types.map(t => t.key)).toEqual(['legenda'])
    expect(intangibleList(content, { kind: 'prica', type: 'stara' })).toBeNull()
  })

  it('keeps only links to what is public', () => {
    const story = intangible.recordById.get(IH.story)!
    expect(story.areaLinks).toEqual([
      { areaId: IH.kalnikSettlement, relation: 'recorded_in' },
      { areaId: IH.region, relation: 'about' }
    ])
    expect(story.authorIds).toEqual([IH.person])
    expect(story.itemIds).toEqual([IH.church])
    expect(story.themeIds).toEqual([IH.themeVino])
    expect(story.sourceIds).toEqual([IH.source])
    expect(story.credits).toEqual([{ name: 'Ana Pošiljateljica', kind: 'memory' }])
    expect(story.narratorLinks.map(l => `${l.narratorId}:${l.role}`)).toEqual([
      `${IH.narratorNamed}:narrator`, `${IH.narratorAnon}:narrator`, `${IH.narratorNamed}:collector`, `${IH.narratorNoDescription}:collector`
    ])
  })

  it('links a Folk text to its Custom only while that Custom is public, and a Custom to its Folk texts', () => {
    expect(intangible.recordById.get(IH.folk)!.customId).toBe(IH.custom)
    expect(intangible.recordById.get(IH.folkOrphan)!.customId).toBeNull()
    expect(intangible.folkTextsByCustom.get(IH.custom)).toEqual([IH.folk])
  })

  it('reads only the live words of a Folk text', () => {
    expect(intangible.recordById.get(IH.folk)!.words).toEqual([{ id: IH.word, headword: 'Martin', slug: 'martin' }])
  })

  it('builds the reverse maps, with persons through a named narrator only', () => {
    expect(intangible.recordsByTheme.get(IH.themeVino)).toEqual(expect.arrayContaining([IH.story, IH.custom, IH.folk, IH.storyNoindex]))
    expect(intangible.recordsByNarrator.get(IH.narratorNamed)).toEqual(expect.arrayContaining([IH.story, IH.folk]))
    expect(intangible.recordsByArea.get(IH.kalnikSettlement)).toEqual(expect.arrayContaining([IH.story, IH.folk]))
    expect(intangible.recordsByPerson.get(IH.person)).toEqual(expect.arrayContaining([IH.story, IH.folk]))
    // The unnamed narrator is linked to a Person too, but that link must not name them.
    expect(intangible.recordsByPerson.has(IH.otherPerson)).toBe(false)
  })
})

describe('narrators and consent', () => {
  it('shows the name only with recorded consent, otherwise the description', () => {
    const named = intangible.narratorById.get(IH.narratorNamed)!
    const anon = intangible.narratorById.get(IH.narratorAnon)!
    expect(named).toMatchObject({ label: 'Marija Horvat', named: true, bornYear: 1938, living: false, settlementId: IH.kalnikSettlement, personId: IH.person })
    expect(anon).toMatchObject({ label: 'kazivač, r. 1950., Kalnik', named: false, bornYear: null, living: null, settlementId: null, personId: null })
  })

  it('never falls back to the name when there is no description', () => {
    const rows = fakeRowsWithIntangible()
    rows.intangible!.narrators = rows.intangible!.narrators.map(n => n.id === IH.narratorNoDescription ? { ...n, slug: 'kazivac-bez-opisa-2' } : n)
    const narrator = buildPublicContent(rows, {}).intangible.narratorById.get(IH.narratorNoDescription)!
    expect(narrator.label).toBe('Kazivač/ica')
    expect(narrator.label).not.toContain('Petar')
  })

  it('leaves out a narrator whose slug or description repeats the name without consent', () => {
    expect(intangible.narratorById.has(IH.narratorLeak)).toBe(false)
    expect(intangible.narratorBySlug.has('josip-kovac')).toBe(false)
    expect(resolveNarrator(content, 'josip-kovac')).toEqual({ status: 'not_found' })

    const rows = fakeRowsWithIntangible()
    rows.intangible!.narrators = rows.intangible!.narrators.map(n => n.id === IH.narratorAnon ? { ...n, public_description: 'kazivač Ivan iz Kalnika' } : n)
    expect(buildPublicContent(rows, {}).intangible.narratorById.has(IH.narratorAnon)).toBe(false)
  })

  it('credits only public narrators on a record', () => {
    const detail = intangibleDetail(content, intangible.recordById.get(IH.story)!)
    expect(detail.narrators.map(n => n.label)).toEqual(['Marija Horvat', 'kazivač, r. 1950., Kalnik'])
    expect(detail.collectors.map(n => n.label)).toEqual(['Marija Horvat', 'Kazivač/ica'])
    expect(detail.narrators.map(n => n.named)).toEqual([true, false])
  })

  it('lists what a narrator told and what they collected, under the same rule', () => {
    const named = narratorPage(content, intangible.narratorById.get(IH.narratorNamed)!)
    expect(named.told.map(r => r.slug).sort()).toEqual(['kalnicka-vjestica', 'martinjska-zdravica'])
    expect(named.collected.map(r => r.slug)).toEqual(['kalnicka-vjestica'])
    expect(named.narrator).toMatchObject({ label: 'Marija Horvat', named: true, bornYear: 1938, living: false })
    expect(named.narrator.person?.slug).toBe('ivan-kalnican')
    expect(named.narrator.settlement?.name).toBe('Kalnik')

    const anon = narratorPage(content, intangible.narratorById.get(IH.narratorAnon)!)
    expect(anon.told.map(r => r.slug)).toEqual(['kalnicka-vjestica'])
    expect(anon.collected.map(r => r.slug)).toEqual(['martinje-u-kalniku'])
    expect(anon.narrator).toMatchObject({ label: 'kazivač, r. 1950., Kalnik', named: false, bornYear: null, living: null, settlement: null, person: null })
  })

  it('never lets a name or an editor-only field reach any public shape', () => {
    const all = everything()
    for (const secret of ['Ivan Novak', 'Josip Kovač', 'josip-kovac', 'Petar Bezopisa', 'ivan-novak', 'Stara Kazivačica']) expect(all).not.toContain(secret)
    expect(all).not.toMatch(/PRIVATN/)
    expect(all).not.toMatch(/consent_note|consentNote|research|search_text|searchText/i)
    expect(all).toContain('Marija Horvat')
  })

  it('drops an old narrator slug that gives away an unnamed narrator, and keeps the others', () => {
    expect(resolveNarrator(content, 'ivan-novak')).toEqual({ status: 'not_found' })
    expect(resolveNarrator(content, 'kazivac-r-1950')).toEqual({ status: 'redirect', path: '/potkalnicko-prigorje/price-i-obicaji/kazivac/kazivac-r-1950-kalnik' })
    expect(resolveNarrator(content, 'marija-h')).toEqual({ status: 'redirect', path: '/potkalnicko-prigorje/price-i-obicaji/kazivac/marija-horvat' })
  })

  it('answers gone for an archived narrator and not found for an unknown one', () => {
    expect(resolveNarrator(content, 'stara-kazivacica')).toEqual({ status: 'gone' })
    expect(resolveNarrator(content, 'nitko')).toEqual({ status: 'not_found' })
    expect(resolveNarrator(content, 'marija-horvat').status).toBe('ok')
  })

  it('does not select private columns from the database', async () => {
    const selects: Record<string, string> = {}
    const empty = { data: [], error: null }
    const query = (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const method of ['in', 'order', 'range', 'eq', 'is']) chain[method] = () => chain
      chain.select = (columns: string) => {
        selects[table] = columns
        return chain
      }
      chain.then = (resolve: (value: typeof empty) => unknown) => resolve(empty)
      return chain
    }
    await loadPublicContentRows({ from: query } as never)
    for (const table of ['stories', 'customs', 'folk_texts', 'narrators', 'themes', 'story_types', 'custom_types', 'folk_text_types', 'occasions', 'story_narrators', 'folk_text_words']) {
      expect(selects[table], table).toBeDefined()
      expect(selects[table], table).not.toMatch(/research_notes|search_text|consent_note|apply_credit|source_submission/)
    }
    expect(selects.narrators).toContain('consent_named')
    expect(selects.narrators).toContain('public_description')
    expect(selects.story_narrators).toContain('record_id:story_id')
  })

  it('reads missing intangible tables as no records, so deploying before the migration keeps the rest of the site up', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = (failure: { message: string } | null) => ({
      from: (table: string) => {
        const result = { data: [], error: table === 'stories' ? failure : null }
        const chain: Record<string, unknown> = {}
        for (const method of ['select', 'in', 'order', 'range', 'eq', 'is']) chain[method] = () => chain
        chain.then = (resolve: (value: typeof result) => unknown) => resolve(result)
        return chain
      }
    }) as never
    const rows = await loadPublicContentRows(client({ message: 'Could not find the table \'public.stories\' in the schema cache' }))
    expect(rows.intangible!.records).toEqual({ story: [], custom: [], folk_text: [] })
    expect(buildPublicContent(rows, {}).intangible.records).toEqual([])
    // Any other failure still fails the load.
    await expect(loadPublicContentRows(client({ message: 'connection reset' }))).rejects.toThrow('connection reset')
    warn.mockRestore()
  })
})

describe('record pages', () => {
  it('resolves live records by kind segment and slug', () => {
    expect(resolveIntangible(content, 'prica', 'kalnicka-vjestica').status).toBe('ok')
    expect(resolveIntangible(content, 'obicaj', 'martinje-u-kalniku').status).toBe('ok')
    expect(resolveIntangible(content, 'usmeni-tekst', 'martinjska-zdravica').status).toBe('ok')
    // A slug is only unique within its kind.
    expect(resolveIntangible(content, 'obicaj', 'kalnicka-vjestica')).toEqual({ status: 'not_found' })
    expect(resolveIntangible(content, 'nepoznato', 'kalnicka-vjestica')).toEqual({ status: 'not_found' })
  })

  it('follows slug history and answers gone for archived records', () => {
    expect(resolveIntangible(content, 'prica', 'stara-vjestica')).toEqual({ status: 'redirect', path: '/potkalnicko-prigorje/price-i-obicaji/prica/kalnicka-vjestica' })
    expect(resolveIntangible(content, 'prica', 'skinuta-prica')).toEqual({ status: 'gone' })
    expect(resolveIntangible(content, 'prica', 'skinuta-stara')).toEqual({ status: 'gone' })
    expect(resolveIntangible(content, 'obicaj', 'napusteni-obicaj')).toEqual({ status: 'gone' })
    expect(resolveIntangible(content, 'prica', 'prica-bez-vrste')).toEqual({ status: 'not_found' })
  })

  it('shapes a Story with everything the page shows', () => {
    const detail = intangibleDetail(content, intangible.recordById.get(IH.story)!)
    expect(detail).toMatchObject({
      kind: 'story', kindLabel: 'Priča', typeLabel: 'legenda/predaja', title: 'Kalnička vještica', path: '/potkalnicko-prigorje/price-i-obicaji/prica/kalnicka-vjestica',
      textLocal: 'Kaj je bilo, bilo je.\nI vu Kalniku.', textStandard: 'Što je bilo, bilo je.', period: 'u turska vremena',
      recordedOn: '12. ožujka 1987.', verification: 'verified', credits: [{ name: 'Ana Pošiljateljica', kind: 'memory' }]
    })
    expect(detail.recordedIn.map(p => p.name)).toEqual(['Kalnik'])
    expect(detail.about.map(p => p.name)).toEqual(['Potkalničko prigorje'])
    expect(detail.about[0]!.path).toBe('/potkalnicko-prigorje/istrazi')
    expect(detail.authors.map(a => a.slug)).toEqual(['ivan-kalnican'])
    expect(detail.heritage.map(h => h.name)).toEqual(['Crkva sv. Brcka'])
    expect(detail.themes.map(t => t.path)).toEqual(['/potkalnicko-prigorje/price-i-obicaji/tema/vino'])
    expect(detail.sources.map(s => s.title)).toEqual(['Registar kulturnih dobara Republike Hrvatske'])
    expect(detail.excerpt).toBe('Što je bilo, bilo je.')
  })

  it('shapes a Custom with its occasion, quotes, approximate era and Folk texts', () => {
    const detail = intangibleDetail(content, intangible.recordById.get(IH.custom)!)
    expect(detail).toMatchObject({
      kind: 'custom', occasion: 'Martinje', description: 'Mošt se krstio u vino.', quotes: ['Sveti Martin, krsti vino!'],
      period: '1960-ih (približno)', recordedOn: 'studeni 1990.'
    })
    expect(detail.folkTexts.map(f => f.title)).toEqual(['Martinjska zdravica'])
    expect(detail.folkTexts[0]).toMatchObject({ kindLabel: 'Usmeni tekst', typeLabel: 'pjesma' })
  })

  it('shapes a Folk text with its Custom and Words, and no period of its own', () => {
    const detail = intangibleDetail(content, intangible.recordById.get(IH.folk)!)
    expect(detail.custom).toMatchObject({ title: 'Martinje u Kalniku', kindLabel: 'Običaj' })
    expect(detail.words).toEqual([{ id: IH.word, headword: 'Martin', path: '/potkalnicko-prigorje/govor/martin' }])
    expect(detail.period).toBeNull()
    expect(detail.recordedOn).toBe('1975.')
    expect(detail.excerpt).toBe('Živio Martin, živilo vino!')
    expect(intangibleDetail(content, intangible.recordById.get(IH.folkOrphan)!).custom).toBeNull()
  })

  it('shows the date only as precisely as it is known', () => {
    expect(formatRecordedOn({ precision: 'year', year: 1987, month: 3, day: 12 })).toBe('1987.')
    expect(formatRecordedOn({ precision: 'month', year: 1987, month: 3, day: 12 })).toBe('ožujak 1987.')
    expect(formatRecordedOn({ precision: 'day', year: 1987, month: 3, day: 12 })).toBe('12. ožujka 1987.')
    expect(formatRecordedOn({ precision: null, year: 1987, month: null, day: null })).toBeNull()
    expect(periodLabel('u turska vremena', 'century', 17)).toBe('u turska vremena')
    expect(periodLabel(null, 'century', 17)).toBe('17. stoljeće (približno)')
    expect(periodLabel(null, null, null)).toBeNull()
  })

  it('cuts an excerpt at a word and never past the text', () => {
    const record = { ...intangible.recordById.get(IH.story)!, textStandard: 'riječ '.repeat(100), textLocal: null }
    const excerpt = intangibleExcerpt(record, 30)!
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt.length).toBeLessThanOrEqual(31)
    expect(intangibleExcerpt({ ...record, textStandard: null, textLocal: null })).toBeNull()
  })

  it('knows the kind segments', () => {
    expect(intangibleKindFromSlug('prica')).toBe('story')
    expect(intangibleKindFromSlug('obicaj')).toBe('custom')
    expect(intangibleKindFromSlug('usmeni-tekst')).toBe('folk_text')
    expect(intangibleKindFromSlug('story')).toBeNull()
  })
})

describe('the list and its filters', () => {
  it('lists every live record with its facets', () => {
    const list = intangibleList(content)!
    expect(list.total).toBe(6)
    expect(list.kinds.map(k => [k.slug, k.count])).toEqual([['prica', 3], ['obicaj', 1], ['usmeni-tekst', 2]])
    expect(list.types).toEqual([])
    expect(list.themes).toEqual([{ slug: 'vino', label: 'Vino', count: 4 }])
    expect(list.places.map(p => [p.slug, p.count])).toEqual([['grad-krizevci', 1], ['opcina-kalnik', 3], ['potkalnicko-prigorje', 1]])
  })

  it('filters by kind, then type', () => {
    expect(intangibleList(content, { kind: 'obicaj' })!.records.map(r => r.slug)).toEqual(['martinje-u-kalniku'])
    const stories = intangibleList(content, { kind: 'prica', type: 'legenda' })!
    expect(stories.records.map(r => r.slug).sort()).toEqual(['kalnicka-vjestica', 'skrivena-prica'])
    expect(stories.types).toEqual([{ key: 'legenda', label: 'legenda/predaja', count: 2 }])
  })

  it('filters by theme and by place (a unit counts its settlements, the region is its own place)', () => {
    expect(intangibleList(content, { theme: 'vino' })!.total).toBe(4)
    expect(intangibleList(content, { theme: 'prazna' })!.total).toBe(0)
    expect(intangibleList(content, { place: 'opcina-kalnik' })!.records.map(r => r.slug).sort()).toEqual(['kalnicka-vjestica', 'martinje-u-kalniku', 'martinjska-zdravica'])
    expect(intangibleList(content, { place: 'grad-krizevci' })!.records.map(r => r.slug)).toEqual(['skrivena-prica'])
    expect(intangibleList(content, { place: 'potkalnicko-prigorje' })!.records.map(r => r.slug)).toEqual(['kalnicka-vjestica'])
  })

  it('counts each facet over what the other filters leave', () => {
    const list = intangibleList(content, { place: 'opcina-kalnik' })!
    expect(list.kinds.map(k => [k.slug, k.count])).toEqual([['prica', 1], ['obicaj', 1], ['usmeni-tekst', 1]])
    const crkvica = intangibleList(content, { kind: 'obicaj', place: 'grad-krizevci' })!
    expect(crkvica.total).toBe(0)
    expect(crkvica.kinds.map(k => k.slug)).toEqual(['prica', 'obicaj'])
  })

  it('refuses a filter that names nothing public', () => {
    expect(intangibleList(content, { kind: 'story' })).toBeNull()
    expect(intangibleList(content, { type: 'legenda' })).toBeNull()
    expect(intangibleList(content, { kind: 'obicaj', type: 'legenda' })).toBeNull()
    expect(intangibleList(content, { theme: 'arhivirana' })).toBeNull()
    expect(intangibleList(content, { place: 'opcina-vani' })).toBeNull()
  })

  it('is empty, not broken, before any record exists', () => {
    const rows = fakeRowsWithIntangible()
    delete rows.intangible
    const empty = buildPublicContent(rows, {})
    expect(intangibleList(empty)).toEqual({ records: [], total: 0, kinds: [], types: [], themes: [], places: [] })
    expect(municipalityPage(empty, empty.municipalities[0]!).intangible).toEqual([])
    expect(resolveIntangible(empty, 'prica', 'kalnicka-vjestica')).toEqual({ status: 'not_found' })
  })
})

describe('themes', () => {
  it('lists a theme\'s records across kinds, by title', () => {
    const page = themePage(content, intangible.themeBySlug.get('vino')!)
    expect(page.theme).toMatchObject({ label: 'Vino', description: 'Što se pilo i sadilo.', path: '/potkalnicko-prigorje/price-i-obicaji/tema/vino' })
    expect(page.records.map(r => r.kindLabel)).toEqual(['Priča', 'Običaj', 'Usmeni tekst', 'Priča'])
    expect(themePage(content, intangible.themeBySlug.get('prazna')!).records).toEqual([])
  })

  it('follows slug history and answers gone for an archived theme', () => {
    expect(resolveTheme(content, 'vinogradi')).toEqual({ status: 'redirect', path: '/potkalnicko-prigorje/price-i-obicaji/tema/vino' })
    expect(resolveTheme(content, 'arhivirana')).toEqual({ status: 'gone' })
    expect(resolveTheme(content, 'nema')).toEqual({ status: 'not_found' })
  })
})

describe('place and person pages', () => {
  it('lists records on a settlement page, exactly that settlement', () => {
    const page = settlementPage(content, content.settlementById.get(IH.kalnikSettlement)!)
    expect(page.intangible.map(r => r.slug).sort()).toEqual(['kalnicka-vjestica', 'martinjska-zdravica'])
    expect(page.intangible[0]).toMatchObject({ kindLabel: expect.any(String), typeLabel: expect.any(String), path: expect.stringContaining('/price-i-obicaji/') })
  })

  it('lists records on a municipality page, including its settlements, but not the region\'s own', () => {
    const kalnik = municipalityPage(content, content.municipalityById.get(IH.kalnikMunicipality)!)
    expect(kalnik.intangible.map(r => r.slug).sort()).toEqual(['kalnicka-vjestica', 'martinje-u-kalniku', 'martinjska-zdravica'])
    const grad = municipalityPage(content, content.municipalityById.get(IH.grad)!)
    expect(grad.intangible.map(r => r.slug)).toEqual(['skrivena-prica'])
  })

  it('lists records on a person page: as author, and through a named narrator who is that person', () => {
    const person = personDetail(content, content.personById.get(IH.person)!)
    expect(person.intangible.map(r => r.slug).sort()).toEqual(['kalnicka-vjestica', 'martinjska-zdravica'])
    // The unnamed narrator is linked to this Person; it must not show up there.
    expect(personDetail(content, content.personById.get(IH.otherPerson)!).intangible).toEqual([])
    const resolved = resolvePerson(content, 'ivan-kalnican')
    expect(resolved.status).toBe('ok')
  })
})

describe('sitemap', () => {
  const paths = sitemapEntries(content).map(entry => entry.path)

  it('lists the page, indexable records, narrators and themes with records', () => {
    expect(paths).toContain('/potkalnicko-prigorje/price-i-obicaji')
    expect(paths).toContain('/potkalnicko-prigorje/price-i-obicaji/prica/kalnicka-vjestica')
    expect(paths).toContain('/potkalnicko-prigorje/price-i-obicaji/obicaj/martinje-u-kalniku')
    expect(paths).toContain('/potkalnicko-prigorje/price-i-obicaji/usmeni-tekst/martinjska-zdravica')
    expect(paths).toContain('/potkalnicko-prigorje/price-i-obicaji/kazivac/marija-horvat')
    expect(paths).toContain('/potkalnicko-prigorje/price-i-obicaji/kazivac/kazivac-r-1950-kalnik')
    expect(paths).toContain('/potkalnicko-prigorje/price-i-obicaji/tema/vino')
  })

  it('leaves out noindex, archived, empty and hidden pages', () => {
    expect(paths).not.toContain('/potkalnicko-prigorje/price-i-obicaji/prica/skrivena-prica')
    expect(paths).not.toContain('/potkalnicko-prigorje/price-i-obicaji/prica/skinuta-prica')
    expect(paths).not.toContain('/potkalnicko-prigorje/price-i-obicaji/tema/prazna')
    expect(paths).not.toContain('/potkalnicko-prigorje/price-i-obicaji/tema/arhivirana')
    expect(paths.some(path => path.includes('josip-kovac') || path.includes('ivan-novak') || path.includes('stara-kazivacica'))).toBe(false)
  })
})
