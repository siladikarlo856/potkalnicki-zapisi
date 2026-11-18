import { describe, expect, it } from 'vitest'
import type { Custom } from '../shared/utils/content/custom'
import type { FolkText } from '../shared/utils/content/folkText'
import type { HistoryRestoreResult, HistoryRevisions } from '../shared/utils/content/history'
import type { KeyedListEntry, Theme } from '../shared/utils/content/intangibleList'
import type { Narrator } from '../shared/utils/content/narrator'
import type { Story } from '../shared/utils/content/story'
import { integrationDb } from './support/integrationDb'

// Intangible heritage over real Postgres: the seeded type lists, the three kinds saved through the admin content API
// and the narrators who told them (a record of their own, named in public only with consent), the three kinds
// saved through the admin content API with their links in one transaction, history and restore, the database rules
// (partial dates, narrators and consent, a Published record needs a text), deletes blocked while a record is in use, and Drafts made from a Memory
// (credited on publishing, withdrawn on rejection). Run with `node scripts/test-challenges.mjs` (disposable Postgres
// and PostgREST, every migration applied); skipped everywhere else. Rows created here have an `intangible-test` slug.
const SECRET = 'content-intangible-review-secret-0123456789'

const db = await integrationDb({ server: { NUXT_REVIEW_SECRET: SECRET } })
const { sql, failure, fetch } = db

let ip = 0
async function api<T = Record<string, unknown>>(path: string, init: { method?: string, body?: unknown } = {}) {
  const headers: Record<string, string> = { 'authorization': `Bearer ${SECRET}`, 'x-forwarded-for': `198.51.100.${(++ip % 250) + 1}` }
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const send = () => fetch(path, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  // A test that only runs SQL leaves the keep-alive socket idle until the server closes it; the next request then fails
  // before the server has read it ("other side closed", UND_ERR_SOCKET), so sending it again once is safe.
  const response = await send().catch((error: { cause?: { code?: string } }) => {
    if (error.cause?.code === 'UND_ERR_SOCKET') return send()
    throw error
  })
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T & { data?: Record<string, unknown> } }
}

const id = (query: string) => sql(query)
const typeId = (table: string, key: string) => id(`select id from ${table} where key = '${key}'`)

async function create<T>(kind: string, body: Record<string, unknown>) {
  const response = await api<{ entity: T }>(`/api/admin/content/${kind}`, { method: 'POST', body })
  expect(response.status, JSON.stringify(response.body)).toBe(201)
  return response.body.entity
}

async function patch<T extends { id: string, revision: number }>(kind: string, entity: T, change: Record<string, unknown>, expected = 200) {
  const response = await api<{ entity: T }>(`/api/admin/content/${kind}/${entity.id}`, { method: 'PATCH', body: { ...entity, revision: entity.revision, ...change } })
  expect(response.status, JSON.stringify(response.body)).toBe(expected)
  return response
}

describe.skipIf(!db.enabled)('intangible heritage over real Postgres', () => {
  it('seeds the three type lists with the agreed values and the reviewed sample content', () => {
    const labels = (table: string) => sql(`select string_agg(label_hr, ' | ' order by sort) from ${table}`)
    expect(labels('story_types')).toBe('legenda/predaja | mitska predaja | bajka | šaljiva priča | životna priča')
    expect(labels('custom_types')).toBe('godišnji običaji | životni običaji | rad i svakodnevica | vjera i pobožnost | društveni život')
    expect(labels('folk_text_types')).toBe('pjesma | molitva | poslovica/izreka | zagonetka | brojalica | kletva/blagoslov | zdravica')
    expect(sql(`select count(*) from story_types where id <> public.content_uuid('story_type:' || key)`)).toBe('0')
    expect(sql(`select count(*) from occasions`)).toBe('0')
    expect(sql(`select count(*) from themes`)).toBe('1')
    expect(sql(`select count(*) from themes where slug = 'iz-mamine-poruke'`)).toBe('1')
    expect(sql(`select count(*) from stories`)).toBe('0')
    expect(sql(`select count(*) from customs`)).toBe('3')
    expect(sql(`select count(*) from folk_texts`)).toBe('87')
    expect(sql(`select count(distinct actor) || ' ' || min(actor) from content_revisions where entity_kind in ('story_type', 'custom_type', 'folk_text_type')`)).toBe('1 import')
  })

  it('is server-only: RLS on and no grant for anon or authenticated on any table', () => {
    const tables = sql(`select string_agg(relname, ',') from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and (relname in ('story_types', 'custom_types', 'folk_text_types', 'occasions', 'themes', 'narrators', 'stories', 'customs', 'folk_texts', 'folk_text_words')
        or relname ~ '^(story|custom|folk_text)_(areas|narrators|authors|heritage_items|themes|sources)$')`).split(',')
    expect(tables).toHaveLength(28)
    for (const table of tables) {
      expect(sql(`select relrowsecurity from pg_class where oid = 'public.${table}'::regclass`), table).toBe('t')
      expect(failure(`set role anon; select count(*) from public.${table};`), table).toMatch(/permission denied/)
      expect(failure(`set role authenticated; select count(*) from public.${table};`), table).toMatch(/permission denied/)
    }
    for (const fn of ['content_story_save(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)', 'content_custom_save(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)',
      'content_folk_text_save(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)']) {
      expect(sql(`select has_function_privilege('anon', 'public.${fn}', 'execute') or has_function_privilege('authenticated', 'public.${fn}', 'execute')`), fn).toBe('f')
      expect(sql(`select has_function_privilege('service_role', 'public.${fn}', 'execute')`), fn).toBe('t')
    }
  })

  it('saves a Story with its places, narrators, authors, theme, items and sources in one transaction, versions it and restores the links', async () => {
    const suffix = crypto.randomUUID().slice(0, 8)
    const settlement = id(`select id from areas where kind = 'settlement' and slug = 'apatovec' limit 1`)
    const region = id(`select id from areas where kind = 'region' limit 1`)
    const person = id(`select id from persons limit 1`)
    const item = id(`select id from heritage_items limit 1`)
    const sourceA = id(`select id from sources limit 1 offset 0`)
    const sourceB = id(`select id from sources limit 1 offset 1`)

    const theme = await create<Theme>('theme', { labelHr: `Intangible test tema ${suffix}`, slug: `intangible-test-tema-${suffix}`, labelEn: 'Test theme' })
    expect(theme.slug).toBe(`intangible-test-tema-${suffix}`)

    // Narrators are records of their own: an anonymous one, a named one (with consent, and a Person) and a collector.
    const anonymous = await create<Narrator>('narrator', { name: 'Intangible Test Anonimna', publicDescription: 'kazivačica, r. 1938., Gornji Fodrovec', bornYear: 1938, settlementId: settlement })
    const named = await create<Narrator>('narrator', { name: `Intangible Test Imenovana ${suffix}`, consentNamed: true, consentNote: 'usmeno, 8. 11. 2026.', personId: person })
    const collector = await create<Narrator>('narrator', { name: 'Intangible Test Ivan', publicDescription: 'zapisivač, Križevci' })

    const slug = `intangible-test-prica-${suffix}`
    const links = {
      areaLinks: [{ areaId: settlement, relation: 'recorded_in' }, { areaId: region, relation: 'about' }],
      narrators: [
        { narratorId: anonymous.id, role: 'narrator' },
        { narratorId: named.id, role: 'narrator' },
        { narratorId: collector.id, role: 'collector' }
      ],
      authorIds: [person],
      itemIds: [item],
      themeIds: [theme.id],
      sourceIds: [sourceB, sourceA]
    }
    const draft = await create<Story>('story', {
      title: `Intangible test priča ${suffix}`,
      slug,
      typeId: typeId('story_types', 'bajka'),
      textLocal: 'Bil je jen put jen vrag na Kalniku.',
      period: 'u turska vremena',
      periodUnit: 'century',
      periodValue: 16,
      recordedPrecision: 'month',
      recordedYear: 2026,
      recordedMonth: 11,
      status: 'draft',
      ...links
    })
    expect(draft.typeLabel).toBe('bajka')
    expect(draft.placesLabel).toBeTruthy()
    expect(draft.areaLinks).toEqual(links.areaLinks)
    expect(draft.narrators).toEqual(links.narrators)
    expect(draft.authorIds).toEqual([person])
    expect(draft.sourceIds).toEqual([sourceB, sourceA])
    expect(sql(`select period_sort_year from stories where id = '${draft.id}'`)).toBe('1501')
    expect(sql(`select recorded_precision || ' ' || recorded_year || ' ' || recorded_month || ' ' || coalesce(recorded_day::text, 'null') from stories where id = '${draft.id}'`)).toBe('month 2026 11 null')

    // A Published Story needs a text; an Unverified one with no narrator or source still publishes.
    await patch('story', draft, { textLocal: null, textStandard: null, status: 'published' }, 400)
    const published = (await patch('story', draft, { status: 'published' })).body.entity
    expect(published.status).toBe('published')
    expect(sql(`select status from stories where id = '${draft.id}'`)).toBe('published')

    // A refused save leaves the row and its links alone: the missing narrator is caught before any write.
    const missing = crypto.randomUUID()
    const refused = await patch('story', published, { narrators: [{ narratorId: missing, role: 'collector' }], authorIds: [missing], themeIds: [missing] }, 400)
    expect(refused.body.data?.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'narrators.0.narratorId' }),
      expect.objectContaining({ path: 'authorIds.0' }),
      expect.objectContaining({ path: 'themeIds.0' })
    ]))
    expect(sql(`select count(*) from story_narrators where story_id = '${draft.id}'`)).toBe('3')

    // The newest revision carries the links, so a restore brings them back.
    const edited = (await patch('story', published, {
      title: `Intangible test priča (izmijenjena) ${suffix}`,
      areaLinks: [{ areaId: settlement, relation: 'about' }],
      narrators: [{ narratorId: collector.id, role: 'collector' }],
      authorIds: [],
      themeIds: [],
      sourceIds: [sourceA]
    })).body.entity
    expect(edited.areaLinks).toEqual([{ areaId: settlement, relation: 'about' }])
    const revisions = await api<HistoryRevisions>(`/api/admin/content/story/${draft.id}/revisions`)
    expect(revisions.status).toBe(200)
    expect(revisions.body.revisions.length).toBeGreaterThanOrEqual(3)
    const published1 = revisions.body.revisions.find(revision => revision.action === 'update' && revision.changes.some(change => change.field === 'status'))!
    expect(sql(`select data->'sidecars'->'sourceIds' from content_revisions where id = ${published1.id}`)).toContain(sourceB)
    const restored = await api<HistoryRestoreResult>(`/api/admin/content/story/${draft.id}/restore`, {
      method: 'POST', body: { revisionId: published1.id, revision: edited.revision }
    })
    expect(restored.status, JSON.stringify(restored.body)).toBe(200)
    const back = restored.body.entity as unknown as Story
    expect(back.title).toBe(`Intangible test priča ${suffix}`)
    expect(back.areaLinks).toEqual(links.areaLinks)
    expect(back.sourceIds).toEqual([sourceB, sourceA])
    expect(back.themeIds).toEqual([theme.id])
    expect(back.narrators).toEqual(links.narrators)
    expect(back.authorIds).toEqual([person])

    // A renamed slug is remembered for redirects.
    const renamed = (await patch('story', back, { slug: `${slug}-nova` })).body.entity
    expect(sql(`select count(*) from content_slug_history where kind = 'story' and entity_id = '${draft.id}' and slug = '${slug}'`)).toBe('1')
    expect(renamed.slug).toBe(`${slug}-nova`)

    // A theme in use cannot be deleted, only archived; its references name the Story.
    const references = await api<{ blocking: boolean, groups: Array<{ kind: string, count: number }> }>(`/api/admin/content/theme/${theme.id}/references`)
    expect(references.body.blocking).toBe(true)
    expect(references.body.groups).toEqual([expect.objectContaining({ kind: 'story', count: 1 })])
    const blocked = await api(`/api/admin/content/theme/${theme.id}?mode=hard`, { method: 'DELETE' })
    expect(blocked.status).toBe(409)

    // The same goes for a narrator, author, place or source a Story names.
    const narratorRefs = await api<{ blocking: boolean, groups: Array<{ kind: string, count: number }> }>(`/api/admin/content/narrator/${anonymous.id}/references`)
    expect(narratorRefs.body.blocking).toBe(true)
    expect(narratorRefs.body.groups).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'story', count: 1 })]))
    expect((await api(`/api/admin/content/narrator/${anonymous.id}?mode=hard`, { method: 'DELETE' })).status).toBe(409)
    const personRefs = await api<{ blocking: boolean, groups: Array<{ kind: string, count: number }> }>(`/api/admin/content/person/${person}/references`)
    expect(personRefs.body.blocking).toBe(true)
    expect(personRefs.body.groups.map(group => group.kind)).toEqual(expect.arrayContaining(['story', 'narrator']))
    expect((await api(`/api/admin/content/story/${draft.id}?mode=hard`, { method: 'DELETE' })).status).toBe(200)
    expect(sql(`select count(*) from story_narrators where story_id = '${draft.id}'`)).toBe('0')
    expect(sql(`select count(*) from story_authors where story_id = '${draft.id}'`)).toBe('0')
    expect(sql(`select count(*) from content_revisions where entity_kind = 'story' and entity_id = '${draft.id}' and action = 'delete'`)).toBe('1')
    expect((await api(`/api/admin/content/theme/${theme.id}?mode=hard`, { method: 'DELETE' })).status).toBe(200)
    for (const narrator of [anonymous, named, collector]) expect((await api(`/api/admin/content/narrator/${narrator.id}?mode=hard`, { method: 'DELETE' })).status).toBe(200)
  })

  it('records a Narrator as its own record: named in public only with consent, one per Person, and listing everything they told', async () => {
    const suffix = crypto.randomUUID().slice(0, 8)
    const settlement = id(`select id from areas where kind = 'settlement' and slug = 'apatovec' limit 1`)
    const region = id(`select id from areas where kind = 'region' limit 1`)
    const person = id(`select id from persons limit 1`)
    const issues = (response: { body: { data?: Record<string, unknown> } }) => ((response.body.data?.issues ?? []) as Array<{ path: string }>).map(issue => issue.path)

    // Without consent the name stays with the editors: a public description is required and may not repeat the name.
    const post = (body: Record<string, unknown>) => api('/api/admin/content/narrator', { method: 'POST', body })
    expect(issues(await post({ name: `Ana Horvat ${suffix}` }))).toEqual(expect.arrayContaining(['publicDescription']))
    expect(issues(await post({ name: `Horvat${suffix}`, publicDescription: `kazivačica horvat${suffix}` }))).toEqual(['slug', 'publicDescription'])
    // The home settlement must be a settlement, and the Person must exist.
    expect(issues(await post({ name: 'Intangible Test Bad', publicDescription: `kazivac ${suffix}`, settlementId: region }))).toEqual(['settlementId'])
    expect(issues(await post({ name: 'Intangible Test Bad', publicDescription: `kazivac ${suffix}`, personId: crypto.randomUUID() }))).toEqual(['personId'])

    const narrator = await create<Narrator>('narrator', {
      name: 'Intangible Test Marija',
      publicDescription: `kazivačica, r. 1938., Gornji Fodrovec ${suffix}`,
      consentNamed: false,
      consentNote: 'nije pristala na navođenje imena',
      living: true,
      bornYear: 1938,
      settlementId: settlement,
      personId: person,
      researchNotes: 'Privatna bilješka.',
      status: 'published'
    })
    expect(narrator.slug).toBe(`kazivacica-r-1938-gornji-fodrovec-${suffix}`)
    expect(narrator.slug).not.toContain('intangible')
    expect(narrator.settlementLabel).toBeTruthy()
    expect(narrator.personLabel).toBeTruthy()
    expect(sql(`select consent_named::text || ' ' || living::text || ' ' || born_year from narrators where id = '${narrator.id}'`)).toBe('false true 1938')
    // Without consent the shared search projection holds the description, never the real name.
    expect(sql(`select (search_text like '%kazivacica%' and search_text not like '%marija%')::text from narrators where id = '${narrator.id}'`)).toBe('true')

    // Another Narrator cannot take the same slug or the same Person: reported on the field.
    const duplicate = await post({ name: 'Intangible Test Ivana', publicDescription: 'kazivačica iz Križevaca', slug: narrator.slug })
    expect(duplicate.status).toBe(409)
    const samePerson = await post({ name: 'Intangible Test Ivana', publicDescription: 'kazivačica iz Križevaca', slug: `kazivacica-krizevci-${suffix}`, personId: person })
    expect(samePerson.status).toBe(409)

    // Everything a narrator told, across the three kinds: what their public page lists.
    const story = await create<Story>('story', {
      title: `Intangible test priča kazivačice ${suffix}`, typeId: typeId('story_types', 'bajka'), textLocal: 'Bil je jen put...',
      narrators: [{ narratorId: narrator.id, role: 'narrator' }], status: 'published'
    })
    const custom = await create<Custom>('custom', {
      title: `Intangible test običaj kazivačice ${suffix}`, typeId: typeId('custom_types', 'godisnji-obicaji'), description: 'Opis.',
      narrators: [{ narratorId: narrator.id, role: 'narrator' }], status: 'published'
    })
    const folk = await create<FolkText>('folk_text', {
      title: `Intangible test pjesma kazivačice ${suffix}`, typeId: typeId('folk_text_types', 'pjesma'), textLocal: 'Tekst.',
      narrators: [{ narratorId: narrator.id, role: 'collector' }], status: 'published'
    })
    expect(sql(`select string_agg(kind || ':' || role, ',' order by kind) from (
      select 'custom' as kind, role from custom_narrators where narrator_id = '${narrator.id}'
      union all select 'folk_text', role from folk_text_narrators where narrator_id = '${narrator.id}'
      union all select 'story', role from story_narrators where narrator_id = '${narrator.id}') t`)).toBe('custom:narrator,folk_text:collector,story:narrator')
    const references = await api<{ blocking: boolean, groups: Array<{ kind: string, count: number }> }>(`/api/admin/content/narrator/${narrator.id}/references`)
    expect(references.body.blocking).toBe(true)
    expect(references.body.groups.filter(group => group.count).map(group => group.kind).sort()).toEqual(['custom', 'folk_text', 'story'])
    // The settlement and the Person cannot be deleted while a Narrator names them.
    const areaRefs = await api<{ blocking: boolean, groups: Array<{ kind: string, count: number }> }>(`/api/admin/content/area/${settlement}/references`)
    expect(areaRefs.status, JSON.stringify(areaRefs.body)).toBe(200)
    expect(areaRefs.body.groups.filter(group => group.kind === 'narrator' && group.count).length).toBe(1)

    // The slug is remembered when it changes, and the change is in the history.
    const renamed = (await patch('narrator', narrator, { slug: `${narrator.slug}-nova` })).body.entity
    expect(sql(`select count(*) from content_slug_history where kind = 'narrator' and entity_id = '${narrator.id}' and slug = '${narrator.slug}'`)).toBe('1')
    const revisions = await api<HistoryRevisions>(`/api/admin/content/narrator/${narrator.id}/revisions`)
    expect(revisions.status).toBe(200)
    expect(revisions.body.revisions.length).toBeGreaterThanOrEqual(2)
    expect(renamed.slug).toBe(`${narrator.slug}-nova`)

    // Consent shows the name in the projection; withdrawing it removes the name, and any slug the name made, from public reach.
    const named = (await patch('narrator', renamed, { consentNamed: true, slug: `intangible-test-marija-${suffix}` })).body.entity
    expect(sql(`select (search_text like '%marija%')::text from narrators where id = '${narrator.id}'`)).toBe('true')
    const withdrawn = (await patch('narrator', named, { consentNamed: false, slug: `kazivacica-gornji-fodrovec-${suffix}` })).body.entity
    expect(withdrawn.consentNamed).toBe(false)
    expect(sql(`select (search_text not like '%marija%')::text from narrators where id = '${narrator.id}'`)).toBe('true')
    expect(sql(`select count(*) from content_slug_history where kind = 'narrator' and entity_id = '${narrator.id}'`)).toBe('0')

    // A narrator in use is archived, never deleted.
    expect((await api(`/api/admin/content/narrator/${narrator.id}?mode=hard`, { method: 'DELETE' })).status).toBe(409)
    for (const [kind, entity] of [['story', story], ['custom', custom], ['folk_text', folk]] as const) {
      expect((await api(`/api/admin/content/${kind}/${entity.id}?mode=hard`, { method: 'DELETE' })).status).toBe(200)
    }
    expect((await api(`/api/admin/content/narrator/${narrator.id}?mode=hard`, { method: 'DELETE' })).status).toBe(200)
  })

  it('links a Custom to its Occasion and a Folk text to its Custom and Words, and keeps a used Custom from being deleted', async () => {
    const suffix = crypto.randomUUID().slice(0, 8)
    const word = id(`select id from heritage_words limit 1`)
    const occasion = await create<KeyedListEntry>('occasion', { key: `intangible-test-martinje-${suffix}`, labelHr: 'Martinje', labelEn: 'Martinmas', sort: 10 })

    const custom = await create<Custom>('custom', {
      title: `Intangible test običaj ${suffix}`,
      typeId: typeId('custom_types', 'godisnji-obicaji'),
      occasionId: occasion.id,
      description: 'Na Martinje se mošt krsti u vino.',
      quotes: ['Mošt se krsti!', 'Vino je gospodin.'],
      period: 'do 1960-ih',
      periodUnit: 'decade',
      periodValue: 1960,
      status: 'published'
    })
    expect(custom.occasionLabel).toBe('Martinje')
    expect(custom.quotes).toEqual(['Mošt se krsti!', 'Vino je gospodin.'])
    expect(sql(`select period_sort_year from customs where id = '${custom.id}'`)).toBe('1960')

    const folk = await create<FolkText>('folk_text', {
      title: `Intangible test zdravica ${suffix}`,
      typeId: typeId('folk_text_types', 'zdravica'),
      customId: custom.id,
      textLocal: 'Zdravi bili, vesel Martinje!',
      wordIds: [word],
      status: 'published'
    })
    expect(folk.customLabel).toBe(custom.title)
    expect(folk.wordIds).toEqual([word])
    expect(sql(`select count(*) from folk_text_words where folk_text_id = '${folk.id}'`)).toBe('1')

    // A Folk text with a missing Custom or Word is refused with an issue on that field.
    const bad = await api('/api/admin/content/folk_text', {
      method: 'POST',
      body: { title: 'x', typeId: typeId('folk_text_types', 'pjesma'), customId: crypto.randomUUID(), wordIds: ['nepostojeca-rijec-' + suffix] }
    })
    expect(bad.status).toBe(400)
    expect(bad.body.data?.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'customId' }), expect.objectContaining({ path: 'wordIds.0' })]))

    // The Custom and its Occasion are in use; the Word keeps a reference too.
    expect((await api<{ blocking: boolean }>(`/api/admin/content/custom/${custom.id}/references`)).body.blocking).toBe(true)
    expect((await api<{ blocking: boolean }>(`/api/admin/content/occasion/${occasion.id}/references`)).body.blocking).toBe(true)
    expect((await api<{ blocking: boolean }>(`/api/admin/content/word/${word}/references`)).body.blocking).toBe(true)
    expect((await api(`/api/admin/content/custom/${custom.id}?mode=hard`, { method: 'DELETE' })).status).toBe(409)
    expect((await api(`/api/admin/content/custom_type/${custom.typeId}?mode=hard`, { method: 'DELETE' })).status).toBe(409)

    expect((await api(`/api/admin/content/folk_text/${folk.id}?mode=hard`, { method: 'DELETE' })).status).toBe(200)
    expect((await api(`/api/admin/content/custom/${custom.id}?mode=hard`, { method: 'DELETE' })).status).toBe(200)
    expect((await api(`/api/admin/content/occasion/${occasion.id}?mode=hard`, { method: 'DELETE' })).status).toBe(200)
  })

  it('guards the data itself: partial dates, approximate periods, narrators and consent, and a text to publish', () => {
    const type = typeId('story_types', 'bajka')
    const insert = (columns: string, values: string) => `insert into stories (title, slug, type_id, ${columns}) values ('intangible-test', 'intangible-test-${crypto.randomUUID().slice(0, 8)}', '${type}', ${values});`
    const refused = (columns: string, values: string) => expect(failure(insert(columns, values)), `${columns} ${values}`).toMatch(/violates check constraint/)

    // Recorded on is as precise as it is known, and never a day that does not exist.
    refused('recorded_precision, recorded_year', `'day', 2026`)
    refused('recorded_precision, recorded_year, recorded_month, recorded_day', `'day', 2026, 2, 30`)
    refused('recorded_precision, recorded_year, recorded_month, recorded_day', `'day', 2026, 2, 29`)
    refused('recorded_precision, recorded_year, recorded_month', `'year', 2026, 3`)
    refused('recorded_precision, recorded_year, recorded_month, recorded_day', `'month', 2026, 3, 1`)
    refused('recorded_year', '2026')
    refused('recorded_precision, recorded_year', `'year', 999`)
    for (const [columns, values] of [
      ['recorded_precision, recorded_year, recorded_month, recorded_day', `'day', 2024, 2, 29`],
      ['recorded_precision, recorded_year, recorded_month', `'month', 2026, 11`],
      ['recorded_precision, recorded_year', `'year', 1962`]
    ] as const) {
      sql(`${insert(columns, values)} delete from stories where title = 'intangible-test';`)
    }

    // An approximate decade or century is whole or absent.
    refused('period_unit, period_value', `'decade', 1965`)
    refused('period_unit, period_value', `'century', 22`)
    refused('period_unit', `'decade'`)
    refused('period_value', '1960')

    // A Published record has a text.
    refused('status', `'published'`)
    expect(failure(`insert into customs (title, slug, type_id, status) values ('c', 'intangible-test-c', '${typeId('custom_types', 'godisnji-obicaji')}', 'published');`)).toMatch(/violates check constraint/)
    expect(failure(`insert into folk_texts (title, slug, type_id, status) values ('f', 'intangible-test-f', '${typeId('folk_text_types', 'pjesma')}', 'published');`)).toMatch(/violates check constraint/)

    // Narrators: the public always has the name (with consent) or an anonymous description; years and places are sane.
    const narratorInsert = (columns: string, values: string) => `insert into narrators (name, slug, ${columns}) values ('Intangible Test', 'intangible-test-n-${crypto.randomUUID().slice(0, 8)}', ${values});`
    expect(failure(narratorInsert('consent_named', 'false'))).toMatch(/narrators_public_identity/)
    expect(failure(narratorInsert('consent_named, public_description', `false, '  '`))).toMatch(/violates check constraint/)
    expect(failure(narratorInsert('public_description, born_year', `'x', 999`))).toMatch(/violates check constraint/)
    expect(failure(`insert into narrators (name, slug, public_description) values ('Intangible Test', 'Loš Slug', 'x');`)).toMatch(/violates check constraint/)
    expect(failure(narratorInsert('public_description, settlement_id', `'x', '${id(`select id from areas where kind = 'region' limit 1`)}'`))).toMatch(/settlement_id must be a settlement/)
    const narrator = id(`with n as (insert into narrators (name, slug, public_description) values ('Intangible Test', 'intangible-test-n-${crypto.randomUUID().slice(0, 8)}', 'x') returning id) select id from n`)
    expect(sql(`select consent_named::text || ' ' || living::text from narrators where id = '${narrator}'`)).toBe('false true')
    sql(`update narrators set consent_named = true, public_description = null where id = '${narrator}'`)
    expect(failure(`update narrators set consent_named = false where id = '${narrator}'`)).toMatch(/narrators_public_identity/)

    // A narrator link has the narrator or collector role, once per role; an author is a Person, once per text.
    const story = id(`with s as (insert into stories (title, slug, type_id) values ('intangible-test', 'intangible-test-links-${crypto.randomUUID().slice(0, 8)}', '${type}') returning id) select id from s`)
    const person = id(`select id from persons limit 1`)
    const link = (role: string) => `insert into story_narrators (story_id, narrator_id, role, position) values ('${story}', '${narrator}', '${role}', 0);`
    expect(failure(link('author'))).toMatch(/violates check constraint/)
    sql(link('narrator'))
    expect(failure(link('narrator'))).toMatch(/duplicate key/)
    sql(link('collector'))
    sql(`insert into story_authors (story_id, person_id, position) values ('${story}', '${person}', 0)`)
    expect(failure(`insert into story_authors (story_id, person_id, position) values ('${story}', '${person}', 1)`)).toMatch(/duplicate key/)
    // A narrator in use cannot be deleted; deleting the story releases it.
    expect(failure(`delete from narrators where id = '${narrator}'`)).toMatch(/foreign key/)
    sql(`delete from stories where id = '${story}'`)
    expect(sql(`select count(*) from story_narrators where narrator_id = '${narrator}'`)).toBe('0')
    sql(`delete from narrators where id = '${narrator}'`)
  })

  it('credits the sender of a Memory when the Draft made from it is published, and withdraws both when the Memory is rejected', async () => {
    const suffix = crypto.randomUUID().slice(0, 8)
    const memory = (name: string) => id(`with s as (insert into heritage_submissions (text, type, name, consent_publish, consent_version, locale)
      values ('Moja baka je pričala o vragu na Kalniku.', 'memory', '${name}', true, 'test', 'hr') returning id) select id from s`)
    const sender = memory('Ana Testić')
    const type = typeId('story_types', 'zivotna-prica')

    const draft = await create<Story>('story', { title: `Intangible test sjećanje ${suffix}`, typeId: type, textStandard: 'Baka je pričala o vragu.', status: 'draft' })
    // The Draft points back at the Memory: the link a Draft made from a Memory carries (createDraft sets it).
    sql(`update stories set source_submission_id = ${sender} where id = '${draft.id}'`)
    // One Memory yields one Draft, whichever kind it becomes.
    expect(failure(`insert into customs (title, slug, type_id, source_submission_id) values ('c', 'intangible-test-c-${suffix}', '${typeId('custom_types', 'godisnji-obicaji')}', ${sender});`)).toMatch(/već je nastao zapis/)

    const stored = (await api<{ entity: Story }>(`/api/admin/content/story/${draft.id}`)).body.entity
    const published = (await patch('story', stored, { status: 'published' })).body.entity
    expect(published.status).toBe('published')
    expect(sql(`select status || ' ' || (applied_entity_id = '${draft.id}')::text from heritage_submissions where id = ${sender}`)).toBe(`approved true`)
    expect(sql(`select credits->0->>'name' || ' ' || (credits->0->>'kind') from stories where id = '${draft.id}'`)).toBe('Ana Testić memory')
    expect(sql(`select submission_id from content_revisions where entity_kind = 'story' and entity_id = '${draft.id}' order by id desc limit 1`)).toBe(sender)

    sql(`update heritage_submissions set status = 'rejected' where id = ${sender}`)
    expect(sql(`select status || ' ' || jsonb_array_length(credits) from stories where id = '${draft.id}'`)).toBe('draft 0')
    expect(sql(`select count(*) from content_revisions where entity_kind = 'story' and entity_id = '${draft.id}' and data->'credits' @> '[{"name":"Ana Testić"}]'`)).toBe('0')

    // Deleting a Memory withdraws what was made from it too, and keeps the editorial record.
    const second = memory('Ivo Testić')
    const custom = await create<Custom>('custom', { title: `Intangible test običaj sjećanje ${suffix}`, typeId: typeId('custom_types', 'zivotni-obicaji'), description: 'Opis.', status: 'draft' })
    sql(`update customs set source_submission_id = ${second} where id = '${custom.id}'`)
    const storedCustom = (await api<{ entity: Custom }>(`/api/admin/content/custom/${custom.id}`)).body.entity
    await patch('custom', storedCustom, { status: 'published' })
    expect(sql(`select credits->0->>'name' from customs where id = '${custom.id}'`)).toBe('Ivo Testić')
    sql(`delete from heritage_submissions where id = ${second}`)
    expect(sql(`select status || ' ' || jsonb_array_length(credits) || ' ' || coalesce(source_submission_id::text, 'null') from customs where id = '${custom.id}'`)).toBe('draft 0 null')

    // A Proposal or Correction cannot target these kinds.
    expect(failure(`insert into heritage_submissions (text, type, target_kind, payload, consent_publish, consent_version, locale)
      values ('p', 'proposal', 'story', '{}', true, 'test', 'hr');`)).toMatch(/violates check constraint/)

    sql(`delete from stories where id = '${draft.id}'; delete from customs where id = '${custom.id}'; delete from heritage_submissions where id = ${sender};`)
  })
})
