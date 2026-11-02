import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

// Content tables (20261103010000_content_tables.sql) on a real Postgres. Run with
// `node scripts/test-challenges.mjs`, which provisions a disposable Postgres and PostgREST, applies
// every migration and removes both afterwards. Skipped everywhere else. Every test builds its own
// uniquely named places, so the tests are independent of each other and of the seed data.
const url = process.env.TEST_CHALLENGE_API_URL
const serviceKey = process.env.TEST_CHALLENGE_SERVICE_KEY ?? ''
const publicKey = process.env.TEST_CHALLENGE_PUBLIC_KEY ?? ''
const container = process.env.TEST_CHALLENGE_CONTAINER ?? ''

function sql(input: string) {
  if (!/^ksh-challenge-test-[a-f0-9]+$/.test(container)) throw new Error('Refusing non-isolated database')
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}
function failure(input: string) {
  try {
    sql(input)
  } catch (error) {
    return String((error as { stderr?: string }).stderr ?? error)
  }
  throw new Error(`Expected the statement to fail: ${input}`)
}
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(url ?? 'http://localhost', serviceKey || 'service', options)

const TABLES = ['areas', 'area_regions', 'heritage_categories', 'sources', 'heritage_items', 'heritage_item_sources',
  'content_legacy_ids', 'content_slug_history', 'content_revisions']
const quote = (value: string | null) => value === null ? 'null' : `'${value.replace(/'/g, '\'\'')}'`
const unique = () => randomBytes(4).toString('hex')

function area(kind: string, parentId: string | null, fields: Record<string, string | null> = {}) {
  const values = { name: `${kind} ${unique()}`, ...fields }
  const columns = Object.keys(values)
  return sql(`insert into public.areas(kind, parent_id, ${columns.join(', ')}) values (${quote(kind)}, ${quote(parentId)}, ${columns.map(c => quote(values[c] ?? null)).join(', ')}) returning id;`)
}
// A fresh country → county → municipality → two settlements, plus a category and a source.
function place() {
  const id = unique()
  const country = area('country', null)
  const county = area('county', country)
  const municipality = area('municipality', county, { slug: `opcina-${id}` })
  const settlement = area('settlement', municipality, { slug: `naselje-${id}` })
  const other = area('settlement', municipality, { slug: `drugo-${id}` })
  const category = sql(`insert into public.heritage_categories(key, label_hr) values ('kat-${id}', 'Kategorija ${id}') returning id;`)
  const source = sql(`insert into public.sources(title, type) values ('Izvor ${id}', 'publication') returning id;`)
  return { id, country, county, municipality, settlement, other, category, source }
}
function item(p: ReturnType<typeof place>, fields: Record<string, string | null> = {}) {
  const values = { name: `Kapela ${unique()}`, slug: `kapela-${unique()}`, settlement_id: p.settlement, ...fields }
  const columns = Object.keys(values)
  return sql(`insert into public.heritage_items(category_id, municipality_id, ${columns.join(', ')}) values (${quote(p.category)}, ${quote(p.municipality)}, ${columns.map(c => quote(values[c] ?? null)).join(', ')}) returning id;`)
}
// Node twin of content_uuid: MD5 with the UUIDv8 version nibble and RFC 9562 variant bits.
function contentUuid(name: string) {
  const b = createHash('md5').update(name).digest()
  b[6] = (b[6]! & 0x0f) | 0x80
  b[8] = (b[8]! & 0x3f) | 0x80
  const hex = b.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

describe.skipIf(!url)('content tables on Postgres', () => {
  it('derives deterministic UUIDv8 ids and folds accents for search', () => {
    const vectors = {
      'heritage_word:hiza': 'f13d74f1-67db-843e-9d87-84ca34aeda1e',
      'area:krizevci': '92140ed6-6420-81d0-8661-91ce0c257f5f',
      'heritage_item:krizevci-crkva-sv-ane': '8ca54414-a168-80b7-bc80-619d7c36827a'
    }
    for (const [name, expected] of Object.entries(vectors)) {
      expect(contentUuid(name)).toBe(expected)
      expect(sql(`select public.content_uuid(${quote(name)});`)).toBe(expected)
    }
    for (let i = 0; i < 40; i++) {
      const name = `source:${unique()}-${i}`
      expect(sql(`select public.content_uuid(${quote(name)});`)).toBe(contentUuid(name))
    }
    expect(contentUuid('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(sql('select public.content_uuid(null) is null;')).toBe('t')
    expect(sql('select public.content_fold(\'Čučerje Ćiro Đurđevac ŠIŽE žuti\');')).toBe('cucerje ciro durdevac size zuti')
    expect(sql('select public.content_fold(null);')).toBe('')
  })

  it('denies every public role, in SQL and through PostgREST', async () => {
    for (const table of TABLES) {
      expect(sql(`select relrowsecurity from pg_class where oid = 'public.${table}'::regclass;`)).toBe('t')
      for (const role of ['anon', 'authenticated']) {
        expect(failure(`set role ${role}; select count(*) from public.${table};`)).toMatch(/permission denied/)
        expect(failure(`set role ${role}; delete from public.${table};`)).toMatch(/permission denied/)
      }
      expect((await service.from(table).select('*', { count: 'exact', head: true })).error).toBeNull()
    }
    for (const role of ['anon', 'authenticated']) {
      expect(failure(`set role ${role}; select public.content_fold('a');`)).toMatch(/permission denied/)
      expect(failure(`set role ${role}; select public.content_uuid('a');`)).toMatch(/permission denied/)
      expect(failure(`set role ${role}; insert into public.sources(title, type) values ('x', 'other');`)).toMatch(/permission denied/)
    }
    const anon = createClient(url!, publicKey, options)
    for (const table of TABLES) expect((await anon.from(table).select('*')).error).not.toBeNull()
    expect((await anon.from('sources').insert({ title: 'Anonimno', type: 'other' })).error).not.toBeNull()
    expect((await anon.rpc('content_fold', { value: 'a' })).error).not.toBeNull()
  })

  it('manages revisions, timestamps and search text, and refuses stale updates', async () => {
    const created = await service.from('sources').insert({ title: 'Župni Ured Čučerje', type: 'publication' }).select('id,revision,search_text,created_at,updated_at').single()
    expect(created.error).toBeNull()
    const id = created.data!.id as string
    expect(created.data).toMatchObject({ revision: 1, search_text: 'zupni ured cucerje publication' })

    const saved = await service.from('sources').update({ title: 'Župni ured Čučerje' }).eq('id', id).eq('revision', 1).select('revision,created_at,updated_at')
    expect(saved.error).toBeNull()
    expect(saved.data).toHaveLength(1)
    expect(saved.data![0]).toMatchObject({ revision: 2, created_at: created.data!.created_at })
    expect(new Date(saved.data![0]!.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(created.data!.updated_at).getTime())

    // A writer that still holds revision 1 matches no row: the API answers 409 from this.
    const stale = await service.from('sources').update({ title: 'Prepisano' }).eq('id', id).eq('revision', 1).select('revision')
    expect(stale.error).toBeNull()
    expect(stale.data).toEqual([])

    expect((await service.from('sources').update({ revision: 7 }).eq('id', id)).error?.message).toMatch(/revision is managed/)
    expect(failure(`update public.sources set id = gen_random_uuid() where id = '${id}';`)).toMatch(/id is immutable/)
    sql(`update public.sources set created_at = '2000-01-01', search_text = 'x' where id = '${id}';`)
    expect(sql(`select revision, created_at = ${quote(created.data!.created_at)}::timestamptz, search_text from public.sources where id = '${id}';`))
      .toBe('3|t|zupni ured cucerje publication')
  })

  it('records every write in content_revisions with its actor, deletes included', () => {
    const p = place()
    sql(`begin; set local app.actor = 'import'; insert into public.heritage_categories(id, key, label_hr) values (public.content_uuid('heritage_category:test-${p.id}'), 'uvoz-${p.id}', 'Uvoz'); commit;`)
    const id = sql(`select public.content_uuid('heritage_category:test-${p.id}');`)
    sql(`update public.heritage_categories set label_hr = 'Uvezeno' where id = '${id}';`)
    sql(`delete from public.heritage_categories where id = '${id}';`)
    const history = sql(`select revision || ' ' || action || ' ' || actor || ' ' || (data->>'label_hr') || ' ' || (data ? 'search_text') from public.content_revisions where entity_kind = 'heritage_category' and entity_id = '${id}' order by id;`)
    expect(history.split('\n')).toEqual(['1 insert import Uvoz false', '2 update admin Uvezeno false', '3 delete admin Uvezeno false'])
    // The delete snapshot holds the whole row, so a restore can re-create it.
    expect(sql(`select data->>'key' from public.content_revisions where entity_id = '${id}' and action = 'delete';`)).toBe(`uvoz-${p.id}`)

    expect(sql(`select count(*) from public.content_revisions where entity_kind = 'area' and entity_id = '${p.settlement}';`)).toBe('1')
    const itemId = item(p)
    expect(sql(`select count(*) from public.content_revisions where entity_kind = 'heritage_item' and entity_id = '${itemId}';`)).toBe('1')

    // A deleted submission leaves the revision but drops the link to it.
    const submission = sql('insert into public.heritage_submissions(text, type, consent_publish, consent_version, locale) values (\'Ispravak\', \'memory\', true, \'2026-10-27\', \'hr\') returning id;')
    const revision = sql(`insert into public.content_revisions(entity_kind, entity_id, revision, action, data, submission_id) values ('heritage_item', '${itemId}', 2, 'update', '{}', ${submission}) returning id;`)
    sql(`delete from public.heritage_submissions where id = ${submission};`)
    expect(sql(`select submission_id is null from public.content_revisions where id = ${revision};`)).toBe('t')
    expect(failure(`insert into public.content_revisions(entity_kind, entity_id, revision, action, data) values ('Bad Kind', '${itemId}', 1, 'update', '{}');`)).toMatch(/check/)
  })

  it('keeps the area hierarchy valid', () => {
    const p = place()
    const town = area('town', p.county, { slug: `grad-${p.id}` })
    expect(failure(`insert into public.areas(kind, parent_id, name) values ('country', '${p.country}', 'Druga');`)).toMatch(/areas_root_is_country/)
    expect(failure('insert into public.areas(kind, name) values (\'county\', \'Bez roditelja\');')).toMatch(/areas_root_is_country/)
    expect(failure(`insert into public.areas(kind, parent_id, name) values ('settlement', '${p.county}', 'Krivo');`)).toMatch(/parent of a settlement must be one of \{town,municipality\}, not a county/)
    expect(failure(`insert into public.areas(kind, parent_id, name) values ('municipality', '${p.municipality}', 'Krivo');`)).toMatch(/parent of a municipality/)
    expect(failure(`insert into public.areas(kind, parent_id, name) values ('settlement', gen_random_uuid(), 'Siroče');`)).toMatch(/foreign key/)
    area('settlement', town)
    area('region', p.county)
    area('region', p.country)

    // No cycles: a county can never sit below its own settlement, because kinds only go down.
    expect(failure(`update public.areas set parent_id = '${p.settlement}' where id = '${p.county}';`)).toMatch(/parent of a county/)
    expect(failure(`update public.areas set parent_id = id where id = '${p.municipality}';`)).toMatch(/parent of a municipality/)
    // A kind change must not orphan children or strand dependent rows.
    expect(failure(`update public.areas set kind = 'region' where id = '${p.county}';`)).toMatch(/child areas/)
    sql(`update public.areas set kind = 'town' where id = '${p.municipality}';`)
    expect(sql(`select kind from public.areas where id = '${p.municipality}';`)).toBe('town')

    // Published towns, municipalities and settlements need a slug; other kinds do not.
    expect(failure(`insert into public.areas(kind, parent_id, name, status) values ('settlement', '${town}', 'Bez slugova', 'published');`)).toMatch(/areas_routable_slug/)
    sql(`insert into public.areas(kind, parent_id, name, status) values ('region', '${p.county}', 'Regija', 'published');`)
    expect(failure(`insert into public.areas(kind, parent_id, name, latitude) values ('settlement', '${town}', 'Pola', 46);`)).toMatch(/areas_coordinates_pair/)
    expect(failure(`insert into public.areas(kind, parent_id, name, slug) values ('settlement', '${town}', 'Loše', 'Loš Slug');`)).toMatch(/check/)
  })

  it('keeps public slugs and external codes unique where they are routed', () => {
    const p = place()
    // Towns and municipalities share /istrazi/<slug>; settlements have their own namespace.
    expect(failure(`insert into public.areas(kind, parent_id, name, slug) values ('town', '${p.county}', 'Grad', 'opcina-${p.id}');`)).toMatch(/areas_route_slug/)
    area('settlement', p.municipality, { slug: `opcina-${p.id}` })
    expect(failure(`insert into public.areas(kind, parent_id, name, slug) values ('settlement', '${p.municipality}', 'Isto', 'naselje-${p.id}');`)).toMatch(/areas_route_slug/)

    const code = String(Date.now()).slice(-9)
    area('settlement', p.municipality, { official_code: code, geonames_id: code })
    expect(failure(`insert into public.areas(kind, parent_id, name, official_code) values ('settlement', '${p.municipality}', 'Kod', '${code}');`)).toMatch(/areas_official_code/)
    area('municipality', p.county, { official_code: code })
    expect(failure(`insert into public.areas(kind, parent_id, name, geonames_id) values ('settlement', '${p.municipality}', 'Geo', '${code}');`)).toMatch(/areas_geonames/)
  })

  it('checks region membership', () => {
    const p = place()
    const region = area('region', p.country)
    sql(`insert into public.area_regions(area_id, region_id) values ('${p.municipality}', '${region}'), ('${p.settlement}', '${region}');`)
    expect(failure(`insert into public.area_regions(area_id, region_id) values ('${p.other}', '${p.county}');`)).toMatch(/region_id must be a region/)
    expect(failure(`insert into public.area_regions(area_id, region_id) values ('${p.country}', '${region}');`)).toMatch(/can be region members/)
    expect(failure(`update public.areas set kind = 'county' where id = '${region}';`)).toMatch(/region with members/)
    expect(failure(`delete from public.areas where id = '${region}';`)).toMatch(/foreign key/)
    // Deleting a member removes only its membership.
    sql(`delete from public.areas where id = '${p.other}';`)
    sql(`delete from public.areas where id = '${p.settlement}';`)
    expect(sql(`select count(*) from public.area_regions where region_id = '${region}';`)).toBe('1')
  })

  it('ties heritage items to a settlement of their municipality', () => {
    const p = place()
    const elsewhere = place()
    const id = item(p, { slug: `crkva-${p.id}` })
    expect(failure(`insert into public.heritage_items(name, slug, category_id, municipality_id, settlement_id) values ('X', 'x', '${p.category}', '${p.municipality}', '${elsewhere.settlement}');`)).toMatch(/settlement of the chosen municipality/)
    expect(failure(`insert into public.heritage_items(name, slug, category_id, municipality_id) values ('X', 'x', '${p.category}', '${p.settlement}');`)).toMatch(/town or municipality/)
    expect(failure(`update public.heritage_items set settlement_id = '${p.municipality}' where id = '${id}';`)).toMatch(/settlement of the chosen municipality/)

    // Slugs are unique per settlement; items without a settlement have no URL and may repeat.
    expect(failure(`insert into public.heritage_items(name, slug, category_id, municipality_id, settlement_id) values ('X', 'crkva-${p.id}', '${p.category}', '${p.municipality}', '${p.settlement}');`)).toMatch(/heritage_items_settlement_slug/)
    item(p, { slug: `crkva-${p.id}`, settlement_id: p.other })
    item(p, { slug: 'raspelo', settlement_id: null })
    item(p, { slug: 'raspelo', settlement_id: null })

    expect(failure(`insert into public.heritage_items(name, slug, category_id, municipality_id, verification) values ('X', 'x', '${p.category}', '${p.municipality}', 'done');`)).toMatch(/check/)
    expect(failure(`insert into public.heritage_items(name, slug, category_id, municipality_id, credits) values ('X', 'x', '${p.category}', '${p.municipality}', '{}');`)).toMatch(/check/)
    expect(failure(`update public.areas set kind = 'town', parent_id = '${p.county}' where id = '${p.settlement}';`)).toMatch(/must stay a settlement/)
  })

  it('carries heritage items along when their settlement moves', () => {
    const p = place()
    const target = area('town', p.county, { slug: `cilj-${p.id}` })
    const id = item(p)
    sql(`update public.areas set parent_id = '${target}' where id = '${p.settlement}';`)
    expect(sql(`select municipality_id = '${target}', revision from public.heritage_items where id = '${id}';`)).toBe('t|2')
    expect(failure(`update public.areas set kind = 'county', parent_id = '${p.country}' where id = '${target}';`)).toMatch(/child areas|stay a town/)
  })

  it('writes slug history for routable slugs', () => {
    const p = place()
    sql(`update public.areas set slug = 'novo-${p.id}' where id = '${p.settlement}';`)
    expect(sql(`select entity_id from public.content_slug_history where kind = 'area' and scope_id is null and slug = 'naselje-${p.id}';`)).toBe(p.settlement)
    // Unrelated edits leave no history.
    sql(`update public.areas set name = 'Preimenovano' where id = '${p.other}';`)
    expect(sql(`select count(*) from public.content_slug_history where entity_id = '${p.other}';`)).toBe('0')

    const id = item(p, { slug: `kapela-${p.id}` })
    sql(`update public.heritage_items set slug = 'kapelica-${p.id}' where id = '${id}';`)
    sql(`update public.heritage_items set settlement_id = '${p.other}' where id = '${id}';`)
    expect(sql(`select scope_id || ' ' || slug from public.content_slug_history where entity_id = '${id}' order by created_at, slug;`).split('\n'))
      .toEqual([`${p.settlement} kapela-${p.id}`, `${p.settlement} kapelica-${p.id}`])

    // An item without a settlement had no URL, so moving or renaming it records nothing.
    const loose = item(p, { slug: `raspelo-${p.id}`, settlement_id: null })
    sql(`update public.heritage_items set slug = 'raspelo-novo-${p.id}' where id = '${loose}';`)
    sql(`update public.heritage_items set settlement_id = '${p.settlement}' where id = '${loose}';`)
    expect(sql(`select count(*) from public.content_slug_history where entity_id = '${loose}';`)).toBe('0')

    // A slug handed back to another row follows its latest owner.
    const second = item(p, { slug: `kapela-${p.id}`, settlement_id: p.settlement })
    sql(`update public.heritage_items set slug = 'treca-${p.id}' where id = '${second}';`)
    expect(sql(`select entity_id from public.content_slug_history where kind = 'heritage_item' and scope_id = '${p.settlement}' and slug = 'kapela-${p.id}';`)).toBe(second)
  })

  it('keeps slug history per URL namespace', () => {
    const p = place()
    const town = area('town', p.county, { slug: `krizevci-${p.id}` })
    const settlement = area('settlement', town, { slug: `krizevci-${p.id}` })
    sql(`update public.areas set slug = 'grad-${p.id}' where id = '${town}';`)
    sql(`update public.areas set slug = 'naselje-novo-${p.id}' where id = '${settlement}';`)
    expect(sql(`select namespace || ' ' || entity_id from public.content_slug_history where kind = 'area' and slug = 'krizevci-${p.id}' order by namespace;`).split('\n'))
      .toEqual([`lau ${town}`, `settlement ${settlement}`])
  })

  it('restricts deleting anything still referenced', () => {
    const p = place()
    const id = item(p)
    sql(`insert into public.heritage_item_sources(item_id, source_id, position) values ('${id}', '${p.source}', 0);`)
    expect(failure(`insert into public.heritage_item_sources(item_id, source_id, position) values ('${id}', '${p.source}', 1);`)).toMatch(/duplicate key/)
    expect(failure(`insert into public.heritage_item_sources(item_id, source_id, position) values ('${id}', gen_random_uuid(), 1);`)).toMatch(/foreign key/)

    for (const statement of [
      `delete from public.areas where id = '${p.settlement}';`,
      `delete from public.areas where id = '${p.municipality}';`,
      `delete from public.areas where id = '${p.county}';`,
      `delete from public.heritage_categories where id = '${p.category}';`,
      `delete from public.sources where id = '${p.source}';`
    ]) expect(failure(statement)).toMatch(/foreign key constraint/)

    // Deleting the item drops its source links, after which the source and places can go.
    sql(`delete from public.heritage_items where id = '${id}';`)
    expect(sql(`select count(*) from public.heritage_item_sources where item_id = '${id}';`)).toBe('0')
    sql(`delete from public.sources where id = '${p.source}'; delete from public.heritage_categories where id = '${p.category}';`)
    sql(`delete from public.areas where id in ('${p.settlement}', '${p.other}'); delete from public.areas where id = '${p.municipality}';`)
    expect(sql(`select count(*) from public.content_revisions where entity_id = '${id}' and action = 'delete';`)).toBe('1')
  })

  it('resolves legacy ids to one entity per kind', () => {
    const p = place()
    sql(`insert into public.content_legacy_ids(kind, legacy_id, entity_id) values ('area', 'legacy-${p.id}', '${p.municipality}'), ('heritage_item', 'legacy-${p.id}', '${p.settlement}');`)
    expect(failure(`insert into public.content_legacy_ids(kind, legacy_id, entity_id) values ('area', 'legacy-${p.id}', '${p.settlement}');`)).toMatch(/duplicate key/)
    expect(failure(`insert into public.content_legacy_ids(kind, legacy_id, entity_id) values ('church', 'x', '${p.settlement}');`)).toMatch(/check/)
    expect(sql(`select entity_id from public.content_legacy_ids where kind = 'area' and legacy_id = 'legacy-${p.id}';`)).toBe(p.municipality)
  })
})
