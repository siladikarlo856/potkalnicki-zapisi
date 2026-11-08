import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentKind, ContentReferenceGroup } from '#shared/utils/content/common'
import {
  validateCustomType, validateFolkTextType, validateOccasion, validateStoryType, validateTheme
} from '#shared/utils/content/intangibleList'
import { defineContentKind } from '../definition'
import { usedBy } from './intangible'

// The editor-managed lists of intangible heritage, like the heritage categories: each is a content kind with its
// own history. An entry in use cannot be deleted (the foreign keys restrict it); archive it instead.

const EXAMPLES = 5

/** Records that use a list entry through a link table (themes). */
async function usedThroughLinks(db: SupabaseClient, id: string): Promise<ContentReferenceGroup[]> {
  const groups: ContentReferenceGroup[] = []
  for (const [prefix, table, label] of [['story', 'stories', 'Priče'], ['custom', 'customs', 'Običaji'], ['folk_text', 'folk_texts', 'Usmeni tekstovi']] as const) {
    const fk = `${prefix}_id`
    const { data, count, error } = await db.from(`${prefix}_themes`).select(`${fk}, ${table}(title)`, { count: 'exact' }).eq('theme_id', id).order(fk).limit(EXAMPLES)
    if (error) throw error
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>
    groups.push({
      kind: prefix,
      label,
      count: count ?? rows.length,
      blocking: true,
      items: rows.map(row => ({ id: row[fk] as string, label: (row[table] as { title: string } | null)?.title ?? String(row[fk]) }))
    })
  }
  return groups
}

function keyedList(kind: ContentKind, table: string, validate: (input: unknown) => ReturnType<typeof validateStoryType>, references: ReturnType<typeof defineContentKind>['references']) {
  return defineContentKind({
    kind,
    table,
    fields: { key: 'key', labelHr: 'label_hr', labelEn: 'label_en', sort: 'sort' },
    labelColumn: 'label_hr',
    validate,
    sorts: { key: 'key', labelHr: 'label_hr', sort: 'sort' },
    defaultSort: 'sort',
    filters: {},
    uniqueConstraints: { [`${table}_key_key`]: 'key' },
    references
  })
}

export const storyTypeKind = keyedList('story_type', 'story_types', validateStoryType,
  (db, id) => usedBy(db, 'stories', 'type_id', id, { kind: 'story', label: 'Priče' }))
export const customTypeKind = keyedList('custom_type', 'custom_types', validateCustomType,
  (db, id) => usedBy(db, 'customs', 'type_id', id, { kind: 'custom', label: 'Običaji' }))
export const folkTextTypeKind = keyedList('folk_text_type', 'folk_text_types', validateFolkTextType,
  (db, id) => usedBy(db, 'folk_texts', 'type_id', id, { kind: 'folk_text', label: 'Usmeni tekstovi' }))
export const occasionKind = keyedList('occasion', 'occasions', validateOccasion,
  (db, id) => usedBy(db, 'customs', 'occasion_id', id, { kind: 'custom', label: 'Običaji' }))

export const themeKind = defineContentKind({
  kind: 'theme',
  table: 'themes',
  fields: { slug: 'slug', labelHr: 'label_hr', labelEn: 'label_en', description: 'description', sort: 'sort' },
  labelColumn: 'label_hr',
  validate: validateTheme,
  sorts: { slug: 'slug', labelHr: 'label_hr', sort: 'sort' },
  defaultSort: 'sort',
  filters: {},
  uniqueConstraints: { themes_slug_key: 'slug' },
  references: usedThroughLinks
})
