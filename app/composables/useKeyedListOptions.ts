import type { ContentKind, ContentList } from '#shared/utils/content/common'
import type { KeyedListEntry } from '#shared/utils/content/intangibleList'

/**
 * The entries of an editor-managed list (story types, custom types, folk text types) as menu options, in the list's
 * own order. An entry that is not Published says so; an archived one is left out, so it cannot be chosen again.
 */
export function useKeyedListOptions(kind: Extract<ContentKind, 'story_type' | 'custom_type' | 'folk_text_type'>) {
  const { data } = useFetch<ContentList<KeyedListEntry>>(`/api/admin/content/${kind}`, {
    query: { size: 100, sort: 'sort' },
    server: false,
    key: `admin-options-${kind}`
  })
  return computed(() => (data.value?.rows ?? [])
    .filter(row => row.status !== 'archived')
    .map(row => ({ label: row.status === 'draft' ? `${row.labelHr} (skica)` : row.labelHr, value: row.id })))
}
