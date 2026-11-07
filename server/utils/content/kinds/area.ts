import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentReferenceGroup, ContentStatus } from '../../../../shared/utils/content/common'
import {
  AREA_KINDS, AREA_KIND_LAU, areaAdminLabel, type AreaFields, type AreaKind, type AreaValue, validateArea
} from '../../../../shared/utils/content/area'
import { defineContentKind } from '../definition'
import { missingLinkIssues } from '../linkCheck'

const EXAMPLES = 5

async function loadRegionIds(db: SupabaseClient, id: string) {
  const { data, error } = await db.from('area_regions').select('region_id').eq('area_id', id).order('region_id')
  if (error) throw error
  return { regionIds: (data ?? []).map(row => String(row.region_id).toLowerCase()) }
}

async function areaReferences(db: SupabaseClient, id: string): Promise<ContentReferenceGroup[]> {
  const groups: ContentReferenceGroup[] = []

  const children = await db.from('areas').select('id, name, kind', { count: 'exact' }).eq('parent_id', id).order('name').limit(EXAMPLES)
  if (children.error) throw children.error
  groups.push({
    kind: 'area',
    label: 'Podređena mjesta',
    count: children.count ?? (children.data ?? []).length,
    blocking: true,
    items: (children.data ?? []).map(row => ({
      id: row.id as string,
      label: areaAdminLabel(row.kind as AreaKind, row.name as string)
    }))
  })

  const asMunicipality = await db.from('heritage_items').select('id, name', { count: 'exact' }).eq('municipality_id', id).order('name').limit(EXAMPLES)
  if (asMunicipality.error) throw asMunicipality.error
  groups.push({
    kind: 'heritage_item',
    label: 'Zapisi baštine (grad/općina)',
    count: asMunicipality.count ?? (asMunicipality.data ?? []).length,
    blocking: true,
    items: (asMunicipality.data ?? []).map(row => ({ id: row.id as string, label: row.name as string }))
  })

  const asSettlement = await db.from('heritage_items').select('id, name', { count: 'exact' }).eq('settlement_id', id).order('name').limit(EXAMPLES)
  if (asSettlement.error) throw asSettlement.error
  groups.push({
    kind: 'heritage_item',
    label: 'Zapisi baštine (naselje)',
    count: asSettlement.count ?? (asSettlement.data ?? []).length,
    blocking: true,
    items: (asSettlement.data ?? []).map(row => ({ id: row.id as string, label: row.name as string }))
  })

  const wordAreas = await db.from('heritage_word_areas').select('word_id', { count: 'exact' }).eq('area_id', id).limit(EXAMPLES)
  if (wordAreas.error) throw wordAreas.error
  groups.push({
    kind: 'word',
    label: 'Riječi (područje upotrebe)',
    count: wordAreas.count ?? (wordAreas.data ?? []).length,
    blocking: true,
    items: (wordAreas.data ?? []).map(row => ({ id: row.word_id as string, label: row.word_id as string }))
  })

  const regionMembers = await db.from('area_regions').select('area_id, areas(name, kind)', { count: 'exact' }).eq('region_id', id).order('area_id').limit(EXAMPLES)
  if (regionMembers.error) throw regionMembers.error
  const memberRows = (regionMembers.data ?? []) as unknown as Array<{ area_id: string, areas: { name: string, kind: AreaKind } | null }>
  groups.push({
    kind: 'area',
    label: 'Članovi regije',
    count: regionMembers.count ?? memberRows.length,
    blocking: true,
    items: memberRows.map(row => ({
      id: row.area_id,
      label: row.areas ? areaAdminLabel(row.areas.kind, row.areas.name) : row.area_id
    }))
  })

  return groups
}

export const areaKind = defineContentKind<AreaFields & { status: ContentStatus }>({
  kind: 'area',
  table: 'areas',
  fields: {
    kind: 'kind',
    parentId: 'parent_id',
    name: 'name',
    slug: 'slug',
    officialCode: 'official_code',
    geonamesId: 'geonames_id',
    latitude: 'latitude',
    longitude: 'longitude',
    description: 'description'
  },
  labelColumn: 'name',
  createdFrom: 'source_submission_id',
  validate: (input, id) => validateArea(input, id),
  sorts: { name: 'name', kind: 'kind' },
  defaultSort: 'name',
  filters: {
    kind: {
      column: 'kind',
      values: [...AREA_KINDS, AREA_KIND_LAU],
      in: { [AREA_KIND_LAU]: ['town', 'municipality'] }
    }
  },
  uniqueConstraints: {
    areas_route_slug: 'slug',
    areas_official_code: 'officialCode',
    areas_geonames: 'geonamesId'
  },
  references: areaReferences,
  sidecars: { fields: ['regionIds'], load: loadRegionIds },
  // The area_regions trigger would refuse a region id that is not a region, but only after the area is saved.
  checkLinks: async (db, value) => missingLinkIssues(
    db, 'areas', (value as unknown as AreaValue).regionIds.map((regionId, index) => [`regionIds.${index}`, regionId] as const), 'Ta regija ne postoji.', { column: 'kind', value: 'region' }
  ),
  // The areas row and its region membership in one transaction (supabase/migrations/20261107010000_content_save.sql).
  // validateArea already empties regionIds for a kind that cannot join a region.
  persist: async (db, id, value, { row, revision }) => {
    const { data, error } = await db.rpc('content_area_save', {
      p_id: id, p_revision: revision ?? null, p_row: row, p_region_ids: (value as unknown as AreaValue).regionIds
    })
    if (error) throw error
    return (data as string | null) ?? null
  },
  lookupLabel: (row: Record<string, unknown>) => areaAdminLabel(row.kind as AreaKind, String(row.name ?? ''))
})
