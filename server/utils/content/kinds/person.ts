import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentReferenceGroup } from '../../../../shared/utils/content/common'
import { validatePerson, type PersonAreaLink, type PersonItemLink } from '../../../../shared/utils/content/person'
import { defineContentKind } from '../definition'
import { missingLinkIssues, missingSourceIssues } from '../linkCheck'

async function loadAreaLinks(db: SupabaseClient, personId: string) {
  const { data, error } = await db.from('person_areas').select('area_id,role,position').eq('person_id', personId).order('position')
  if (error) throw error
  return (data ?? []).map(row => ({ areaId: row.area_id as string, role: row.role as PersonAreaLink['role'] }))
}

async function loadItemLinks(db: SupabaseClient, personId: string) {
  const { data, error } = await db.from('person_heritage_items').select('item_id,relation,position').eq('person_id', personId).order('position')
  if (error) throw error
  return (data ?? []).map(row => ({ itemId: row.item_id as string, relation: row.relation as string }))
}

async function loadSourceIds(db: SupabaseClient, personId: string) {
  const { data, error } = await db.from('person_sources').select('source_id,position').eq('person_id', personId).order('position')
  if (error) throw error
  return (data ?? []).map(row => row.source_id as string)
}

async function saveAreaLinks(db: SupabaseClient, personId: string, links: PersonAreaLink[]) {
  const { error: deleteError } = await db.from('person_areas').delete().eq('person_id', personId)
  if (deleteError) throw deleteError
  if (!links.length) return
  const { error } = await db.from('person_areas').insert(links.map((link, position) => ({
    person_id: personId, area_id: link.areaId, role: link.role, position
  })))
  if (error) throw error
}

async function saveItemLinks(db: SupabaseClient, personId: string, links: PersonItemLink[]) {
  const { error: deleteError } = await db.from('person_heritage_items').delete().eq('person_id', personId)
  if (deleteError) throw deleteError
  if (!links.length) return
  const { error } = await db.from('person_heritage_items').insert(links.map((link, position) => ({
    person_id: personId, item_id: link.itemId, relation: link.relation, position
  })))
  if (error) throw error
}

async function saveSourceIds(db: SupabaseClient, personId: string, sourceIds: string[]) {
  const { error: deleteError } = await db.from('person_sources').delete().eq('person_id', personId)
  if (deleteError) throw deleteError
  if (!sourceIds.length) return
  const { error } = await db.from('person_sources').insert(sourceIds.map((source_id, position) => ({ person_id: personId, source_id, position })))
  if (error) throw error
}

function formatYears(bornYear: number | null, diedYear: number) {
  if (bornYear) return `${bornYear}–${diedYear}`
  return String(diedYear)
}

export const personKind = defineContentKind({
  kind: 'person',
  table: 'persons',
  fields: {
    name: 'name',
    slug: 'slug',
    role: 'role',
    clue: 'clue',
    bio: 'bio',
    born: 'born',
    bornYear: 'born_year',
    bornPlace: 'born_place',
    died: 'died',
    diedYear: 'died_year',
    diedPlace: 'died_place',
    openQuestions: 'open_questions',
    researchNotes: 'research_notes',
    verification: 'verification',
    noindex: 'noindex'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  labelColumn: 'name',
  validate: validatePerson,
  sorts: { name: 'name', verification: 'verification', diedYear: 'died_year' },
  defaultSort: 'name',
  filters: {
    verification: { column: 'verification', values: ['unverified', 'in_review', 'verified', 'needs_update'] }
  },
  uniqueConstraints: { persons_slug_key: 'slug' },
  references: async (db, id) => {
    const groups: ContentReferenceGroup[] = []
    const { count, error } = await db.from('person_areas').select('person_id', { count: 'exact', head: true }).eq('person_id', id)
    if (error) throw error
    if (count) groups.push({ kind: 'person_area', label: 'Veze na mjesta', count, blocking: false, items: [] })
    return groups
  },
  inputFields: ['areaLinks', 'itemLinks', 'sourceIds'],
  loadEntity: async (db, entity) => ({
    areaLinks: await loadAreaLinks(db, entity.id),
    itemLinks: await loadItemLinks(db, entity.id),
    sourceIds: await loadSourceIds(db, entity.id)
  }),
  // "A Published person needs a source" is a rule of validatePerson, so it is refused before any write.
  checkLinks: async (db, value) => [
    ...await missingLinkIssues(db, 'areas', value.areaLinks.map((link, index) => [`areaLinks.${index}.areaId`, link.areaId] as const), 'To mjesto ne postoji.'),
    ...await missingLinkIssues(db, 'heritage_items', value.itemLinks.map((link, index) => [`itemLinks.${index}.itemId`, link.itemId] as const), 'Taj zapis baštine ne postoji.'),
    ...await missingSourceIssues(db, value.sourceIds)
  ],
  // The persons row and its link tables in one transaction (supabase/migrations/20261107000000_person_save.sql).
  persist: async (db, id, value, { row, revision }) => {
    const { data, error } = await db.rpc('content_person_save', {
      p_id: id,
      p_revision: revision ?? null,
      p_row: row,
      p_area_links: value.areaLinks,
      p_item_links: value.itemLinks,
      p_source_ids: value.sourceIds
    })
    if (error) throw error
    return (data as string | null) ?? null
  },
  // Still used by a history restore; it moves to `persist` with the other kinds.
  persistEntity: async (db, id, value) => {
    await saveAreaLinks(db, id, (value.areaLinks as PersonAreaLink[]) ?? [])
    await saveItemLinks(db, id, (value.itemLinks as PersonItemLink[]) ?? [])
    await saveSourceIds(db, id, (value.sourceIds as string[]) ?? [])
  },
  async enrichRows(db, rows) {
    if (!rows.length) return rows
    const ids = rows.map(row => row.id as string)
    const areaRows = new Map<string, string[]>()
    const { data: links, error } = await db.from('person_areas').select('person_id,area_id,position').in('person_id', ids).order('position')
    if (error) throw error
    const areaIds = [...new Set((links ?? []).map(row => row.area_id as string))]
    const areaNames = new Map<string, string>()
    if (areaIds.length) {
      const { data: areas } = await db.from('areas').select('id,name').in('id', areaIds)
      for (const area of areas ?? []) areaNames.set(area.id as string, area.name as string)
    }
    for (const link of links ?? []) {
      const key = link.person_id as string
      const label = areaNames.get(link.area_id as string)
      if (!label) continue
      const list = areaRows.get(key) ?? []
      if (!list.includes(label)) list.push(label)
      areaRows.set(key, list)
    }
    return rows.map(row => ({
      ...row,
      years_label: formatYears(row.born_year as number | null, row.died_year as number),
      places_label: (areaRows.get(row.id as string) ?? []).slice(0, 3).join(' · ') || null
    }))
  },
  toEntityExtra(row: Record<string, unknown>) {
    return {
      yearsLabel: (row.years_label as string | null | undefined) ?? null,
      placesLabel: (row.places_label as string | null | undefined) ?? null
    }
  }
})
