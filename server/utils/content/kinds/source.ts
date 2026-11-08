import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentReferenceGroup } from '../../../../shared/utils/content/common'
import { SOURCE_TYPES, validateSource } from '../../../../shared/utils/content/source'
import { defineContentKind } from '../definition'
import { intangibleReferences } from './intangible'

const EXAMPLES = 5

/** Heritage items citing the source; `heritage_item_sources.source_id` is `on delete restrict`. */
async function sourceReferences(db: SupabaseClient, id: string): Promise<ContentReferenceGroup[]> {
  const { data, count, error } = await db.from('heritage_item_sources')
    .select('item_id, heritage_items(name)', { count: 'exact' })
    .eq('source_id', id)
    .order('item_id')
    .limit(EXAMPLES)
  if (error) throw error
  const rows = (data ?? []) as unknown as Array<{ item_id: string, heritage_items: { name: string } | null }>
  return [...await intangibleReferences(db, 'source', id), {
    kind: 'heritage_item',
    label: 'Zapisi baštine',
    count: count ?? rows.length,
    blocking: true,
    items: rows.map(row => ({ id: row.item_id, label: row.heritage_items?.name ?? row.item_id }))
  }]
}

export const sourceKind = defineContentKind({
  kind: 'source',
  table: 'sources',
  fields: { title: 'title', type: 'type', url: 'url', note: 'note' },
  labelColumn: 'title',
  createdFrom: 'source_submission_id',
  validate: validateSource,
  sorts: { title: 'title', type: 'type' },
  defaultSort: 'title',
  filters: { type: { column: 'type', values: SOURCE_TYPES } },
  references: sourceReferences
})
