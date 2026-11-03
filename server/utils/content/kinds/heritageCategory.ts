import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentReferenceGroup } from '../../../../shared/utils/content/common'
import { validateHeritageCategory } from '../../../../shared/utils/content/category'
import { defineContentKind } from '../definition'

const EXAMPLES = 5

async function categoryReferences(db: SupabaseClient, id: string): Promise<ContentReferenceGroup[]> {
  const { count, error } = await db.from('heritage_items').select('id', { count: 'exact', head: true }).eq('category_id', id)
  if (error) throw error
  if (!count) return []
  const { data } = await db.from('heritage_items').select('id,name').eq('category_id', id).order('name').limit(EXAMPLES)
  return [{
    kind: 'heritage_item',
    label: 'Zapisi baštine',
    count,
    blocking: true,
    items: (data ?? []).map(row => ({ id: row.id as string, label: row.name as string }))
  }]
}

export const heritageCategoryKind = defineContentKind({
  kind: 'heritage_category',
  table: 'heritage_categories',
  fields: { key: 'key', labelHr: 'label_hr', labelEn: 'label_en', sort: 'sort' },
  labelColumn: 'label_hr',
  validate: validateHeritageCategory,
  sorts: { key: 'key', labelHr: 'label_hr', sort: 'sort' },
  defaultSort: 'sort',
  filters: {},
  uniqueConstraints: { heritage_categories_key_key: 'key' },
  references: categoryReferences
})
