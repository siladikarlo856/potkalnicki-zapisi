import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentIssue, ContentReferenceGroup } from '#shared/utils/content/common'
import type { AreaLink, AreaRelation, IntangibleLinks, PeopleLink, PeopleRole } from '#shared/utils/content/intangible'
import { missingLinkIssues, missingSourceIssues } from '../linkCheck'

// What the three intangible heritage kinds (stories, customs, folk_texts) have in common on the server: their link
// tables and how to read them, the rules on linked rows, the labels the admin list shows and the references that
// stop a linked row from being deleted. Table names follow the kind: `<prefix>_areas`, `<prefix>_people`, ...

export type IntangiblePrefix = 'story' | 'custom' | 'folk_text'
const PREFIXES = ['story', 'custom', 'folk_text'] as const
const TABLES: Record<IntangiblePrefix, string> = { story: 'stories', custom: 'customs', folk_text: 'folk_texts' }
const LABELS: Record<IntangiblePrefix, string> = { story: 'Priče', custom: 'Običaji', folk_text: 'Usmeni tekstovi' }
const EXAMPLES = 5

type Row = Record<string, unknown>

export async function loadAreaLinks(db: SupabaseClient, prefix: IntangiblePrefix, id: string): Promise<AreaLink[]> {
  const { data, error } = await db.from(`${prefix}_areas`).select('area_id,relation,position').eq(`${prefix}_id`, id).order('position')
  if (error) throw error
  return (data ?? []).map(row => ({ areaId: row.area_id as string, relation: row.relation as AreaRelation }))
}

export async function loadPeople(db: SupabaseClient, prefix: IntangiblePrefix, id: string): Promise<PeopleLink[]> {
  const { data, error } = await db.from(`${prefix}_people`)
    .select('role,person_id,consent_named,consent_note,description,position').eq(`${prefix}_id`, id).order('position')
  if (error) throw error
  return (data ?? []).map(row => ({
    role: row.role as PeopleRole,
    personId: (row.person_id as string | null) ?? null,
    consentNamed: row.consent_named as boolean,
    consentNote: (row.consent_note as string | null) ?? null,
    description: (row.description as string | null) ?? null
  }))
}

/** The ids a link table holds for one record, in order (items, themes, sources, words). */
async function loadIds(db: SupabaseClient, table: string, fk: string, column: string, id: string) {
  const { data, error } = await db.from(table).select(`${column},position`).eq(fk, id).order('position')
  if (error) throw error
  return ((data ?? []) as unknown as Row[]).map(row => row[column] as string)
}

/** The links every kind has, in the API's shape. */
export async function loadLinks(db: SupabaseClient, prefix: IntangiblePrefix, id: string): Promise<IntangibleLinks> {
  const fk = `${prefix}_id`
  return {
    areaLinks: await loadAreaLinks(db, prefix, id),
    people: await loadPeople(db, prefix, id),
    itemIds: await loadIds(db, `${prefix}_heritage_items`, fk, 'item_id', id),
    themeIds: await loadIds(db, `${prefix}_themes`, fk, 'theme_id', id),
    sourceIds: await loadIds(db, `${prefix}_sources`, fk, 'source_id', id)
  }
}

export function loadWordIds(db: SupabaseClient, id: string) {
  return loadIds(db, 'folk_text_words', 'folk_text_id', 'word_id', id)
}

/** The rules on linked rows that need the database: every place, person, heritage item, theme and source exists. */
export async function checkLinks(db: SupabaseClient, links: IntangibleLinks): Promise<ContentIssue[]> {
  return [
    ...await missingLinkIssues(db, 'areas', links.areaLinks.map((link, index) => [`areaLinks.${index}.areaId`, link.areaId] as const), 'To mjesto ne postoji.'),
    ...await missingLinkIssues(
      db, 'persons',
      links.people.flatMap((link, index) => link.personId ? [[`people.${index}.personId`, link.personId] as const] : []),
      'Ta osoba ne postoji.'
    ),
    ...await missingLinkIssues(db, 'heritage_items', links.itemIds.map((id, index) => [`itemIds.${index}`, id] as const), 'Taj zapis baštine ne postoji.'),
    ...await missingLinkIssues(db, 'themes', links.themeIds.map((id, index) => [`themeIds.${index}`, id] as const), 'Ta tema ne postoji.'),
    ...await missingSourceIssues(db, links.sourceIds)
  ]
}

/** The link rows as the JSON arguments of a content_*_save function. */
export function linkArguments(links: IntangibleLinks) {
  return {
    p_area_links: links.areaLinks,
    p_people: links.people,
    p_item_ids: links.itemIds,
    p_theme_ids: links.themeIds,
    p_source_ids: links.sourceIds
  }
}

/** Names the areas a record was recorded in (up to three), by record id, for the admin list. */
async function placesLabels(db: SupabaseClient, prefix: IntangiblePrefix, ids: string[]) {
  const labels = new Map<string, string>()
  if (!ids.length) return labels
  const { data, error } = await db.from(`${prefix}_areas`).select(`${prefix}_id,area_id,position`)
    .in(`${prefix}_id`, ids).eq('relation', 'recorded_in').order('position')
  if (error) throw error
  const links = (data ?? []) as unknown as Row[]
  const areaIds = [...new Set(links.map(row => row.area_id as string))]
  const names = new Map<string, string>()
  if (areaIds.length) {
    const { data: areas, error: areaError } = await db.from('areas').select('id,name').in('id', areaIds)
    if (areaError) throw areaError
    for (const area of areas ?? []) names.set(area.id as string, area.name as string)
  }
  const perRecord = new Map<string, string[]>()
  for (const row of links) {
    const name = names.get(row.area_id as string)
    if (!name) continue
    const list = perRecord.get(row[`${prefix}_id`] as string) ?? []
    if (!list.includes(name)) list.push(name)
    perRecord.set(row[`${prefix}_id`] as string, list)
  }
  for (const [id, list] of perRecord) labels.set(id, list.slice(0, 3).join(' · '))
  return labels
}

async function labelsOf(db: SupabaseClient, table: string, ids: unknown[], column: string) {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === 'string'))]
  const labels = new Map<string, string>()
  if (!unique.length) return labels
  const { data, error } = await db.from(table).select(`id,${column}`).in('id', unique)
  if (error) throw error
  for (const row of (data ?? []) as unknown as Row[]) labels.set(row.id as string, row[column] as string)
  return labels
}

/**
 * The derived fields of an admin list row: the label of its type (and of the optional `occasionId` or `customId`
 * it points at) and the places it was recorded in. `extra` names the foreign key and label of those two.
 */
export async function deriveLabels(
  db: SupabaseClient, prefix: IntangiblePrefix, typeTable: string, values: Row[],
  extra?: { field: 'occasionId' | 'customId', table: string, column: string, label: 'occasionLabel' | 'customLabel' }
): Promise<Row[]> {
  const ids = values.map(value => value.id).filter((id): id is string => typeof id === 'string')
  const types = await labelsOf(db, typeTable, values.map(value => value.typeId), 'label_hr')
  const others = extra ? await labelsOf(db, extra.table, values.map(value => value[extra.field]), extra.column) : new Map<string, string>()
  const places = await placesLabels(db, prefix, ids)
  return values.map(value => ({
    ...value,
    typeLabel: types.get(value.typeId as string) ?? null,
    ...(extra ? { [extra.label]: others.get(value[extra.field] as string) ?? null } : {}),
    placesLabel: places.get(value.id as string) ?? null
  }))
}

/** Missing type, occasion or custom: refused with an issue on its field rather than by a foreign key inside the save. */
export function checkOwnLinks(db: SupabaseClient, links: ReadonlyArray<readonly [path: string, id: string | null, table: string, message: string]>) {
  return Promise.all(links.filter(([, id]) => id).map(([path, id, table, message]) => missingLinkIssues(db, table, [[path, id!] as const], message)))
    .then(groups => groups.flat())
}

/**
 * Records that link to a row of another kind (a place, person, heritage item, source or word). Each link table
 * restricts that row's deletion, so the groups are blocking: archive it instead.
 */
export async function intangibleReferences(
  db: SupabaseClient, link: 'area' | 'person' | 'heritage_item' | 'source' | 'word', id: string
): Promise<ContentReferenceGroup[]> {
  const spec = {
    area: { table: 'areas', column: 'area_id' },
    person: { table: 'people', column: 'person_id' },
    heritage_item: { table: 'heritage_items', column: 'item_id' },
    source: { table: 'sources', column: 'source_id' },
    word: { table: 'words', column: 'word_id' }
  }[link]
  const groups: ContentReferenceGroup[] = []
  for (const prefix of PREFIXES) {
    if (link === 'word' && prefix !== 'folk_text') continue
    const fk = `${prefix}_id`
    const { data, count, error } = await db.from(`${prefix}_${spec.table}`)
      .select(`${fk}, ${TABLES[prefix]}(title)`, { count: 'exact' })
      .eq(spec.column, id).order(fk).limit(EXAMPLES)
    if (error) throw error
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>
    groups.push({
      kind: prefix,
      label: LABELS[prefix],
      count: count ?? rows.length,
      blocking: true,
      items: rows.map((row) => {
        const record = row[TABLES[prefix]] as { title: string } | null
        return { id: row[fk] as string, label: record?.title ?? String(row[fk]) }
      })
    })
  }
  return groups
}

/** Rows of `table` whose `column` is `id` (a type, occasion or custom in use), as one blocking group. */
export async function usedBy(
  db: SupabaseClient, table: string, column: string, id: string, group: { kind: string, label: string }
): Promise<ContentReferenceGroup[]> {
  const { data, count, error } = await db.from(table).select('id,title', { count: 'exact' }).eq(column, id).order('title').limit(EXAMPLES)
  if (error) throw error
  const rows = data ?? []
  return [{ ...group, count: count ?? rows.length, blocking: true, items: rows.map(row => ({ id: row.id as string, label: row.title as string })) }]
}
