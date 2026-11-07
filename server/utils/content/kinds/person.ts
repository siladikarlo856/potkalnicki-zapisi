import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentReferenceGroup } from '../../../../shared/utils/content/common'
import { validatePerson, type PersonAreaLink } from '../../../../shared/utils/content/person'
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
  createdFrom: 'source_submission_id',
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
  sidecars: {
    fields: ['areaLinks', 'itemLinks', 'sourceIds'],
    load: async (db, id) => ({
      areaLinks: await loadAreaLinks(db, id),
      itemLinks: await loadItemLinks(db, id),
      sourceIds: await loadSourceIds(db, id)
    })
  },
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
  // The years and up to three places, for the admin list.
  async derive(db, values) {
    const ids = values.map(value => value.id).filter((id): id is string => typeof id === 'string')
    const places = new Map<string, string[]>()
    if (ids.length) {
      const { data: links, error } = await db.from('person_areas').select('person_id,area_id,position').in('person_id', ids).order('position')
      if (error) throw error
      const areaIds = [...new Set((links ?? []).map(row => row.area_id as string))]
      const areaNames = new Map<string, string>()
      if (areaIds.length) {
        const { data: areas, error: areaError } = await db.from('areas').select('id,name').in('id', areaIds)
        if (areaError) throw areaError
        for (const area of areas ?? []) areaNames.set(area.id as string, area.name as string)
      }
      for (const link of links ?? []) {
        const label = areaNames.get(link.area_id as string)
        if (!label) continue
        const list = places.get(link.person_id as string) ?? []
        if (!list.includes(label)) list.push(label)
        places.set(link.person_id as string, list)
      }
    }
    return values.map(value => ({
      ...value,
      yearsLabel: typeof value.diedYear === 'number' ? formatYears(value.bornYear as number | null, value.diedYear) : null,
      placesLabel: (places.get(value.id as string) ?? []).slice(0, 3).join(' · ') || null
    }))
  }
})
