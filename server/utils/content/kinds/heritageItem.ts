import type { SupabaseClient } from '@supabase/supabase-js'
import { validateHeritageItem } from '../../../../shared/utils/content/heritageItem'
import { defineContentKind } from '../definition'
import { missingSourceIssues } from '../linkCheck'

async function loadSourceIds(db: SupabaseClient, itemId: string) {
  const { data, error } = await db.from('heritage_item_sources')
    .select('source_id,position').eq('item_id', itemId).order('position')
  if (error) throw error
  return (data ?? []).map(row => row.source_id as string)
}

async function saveSourceIds(db: SupabaseClient, itemId: string, sourceIds: string[]) {
  const { error: deleteError } = await db.from('heritage_item_sources').delete().eq('item_id', itemId)
  if (deleteError) throw deleteError
  if (!sourceIds.length) return
  const { error } = await db.from('heritage_item_sources').insert(sourceIds.map((source_id, position) => ({ item_id: itemId, source_id, position })))
  if (error) throw error
}

export const heritageItemKind = defineContentKind({
  kind: 'heritage_item',
  table: 'heritage_items',
  fields: {
    name: 'name',
    slug: 'slug',
    categoryId: 'category_id',
    municipalityId: 'municipality_id',
    settlementId: 'settlement_id',
    locality: 'locality',
    verification: 'verification',
    heritageStatus: 'heritage_status',
    registryNumber: 'registry_number',
    period: 'period',
    description: 'description',
    researchNotes: 'research_notes',
    latitude: 'latitude',
    longitude: 'longitude',
    noindex: 'noindex'
  // sourceIds live in heritage_item_sources (sidecar), not on the row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  labelColumn: 'name',
  validate: validateHeritageItem,
  sorts: { name: 'name', verification: 'verification' },
  defaultSort: 'name',
  filters: {
    categoryId: { column: 'category_id', values: [] },
    municipalityId: { column: 'municipality_id', values: [] },
    verification: { column: 'verification', values: ['unverified', 'in_review', 'verified', 'needs_update'] }
  },
  uniqueConstraints: { heritage_items_settlement_slug: 'slug' },
  references: async () => [],
  inputFields: ['sourceIds'],
  loadEntity: async (db, entity) => ({ sourceIds: await loadSourceIds(db, entity.id) }),
  checkLinks: async (db, value) => missingSourceIssues(db, value.sourceIds),
  // The heritage_items row and its sources in one transaction (supabase/migrations/20261107010000_content_save.sql).
  persist: async (db, id, value, { row, revision }) => {
    const { data, error } = await db.rpc('content_heritage_item_save', {
      p_id: id, p_revision: revision ?? null, p_row: row, p_source_ids: value.sourceIds ?? []
    })
    if (error) throw error
    return (data as string | null) ?? null
  },
  // Still used by a history restore; it moves to `persist` with the restore.
  persistEntity: async (db, id, value) => saveSourceIds(db, id, (value.sourceIds as string[]) ?? []),
  async enrichRows(db, rows) {
    if (!rows.length) return rows
    const settlementIds = [...new Set(rows.map(row => row.settlement_id).filter(Boolean) as string[])]
    const categoryIds = [...new Set(rows.map(row => row.category_id).filter(Boolean) as string[])]
    const settlements = new Map<string, string>()
    const categories = new Map<string, string>()
    if (settlementIds.length) {
      const { data } = await db.from('areas').select('id,slug').in('id', settlementIds)
      for (const row of data ?? []) settlements.set(row.id as string, row.slug as string)
    }
    if (categoryIds.length) {
      const { data } = await db.from('heritage_categories').select('id,label_hr').in('id', categoryIds)
      for (const row of data ?? []) categories.set(row.id as string, row.label_hr as string)
    }
    return rows.map(row => ({
      ...row,
      settlement_slug: row.settlement_id ? settlements.get(row.settlement_id as string) ?? null : null,
      category_label: categories.get(row.category_id as string) ?? null
    }))
  },
  toEntityExtra(row: Record<string, unknown>) {
    return {
      settlementSlug: (row.settlement_slug as string | null | undefined) ?? null,
      categoryLabel: (row.category_label as string | null | undefined) ?? null
    }
  }
})
