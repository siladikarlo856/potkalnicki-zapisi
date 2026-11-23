import type { ContentLookupItem, ContentStatus } from '#shared/utils/content/common'

// Select menus that search the server (`/api/admin/lookup/:kind`, `/api/admin/lookup/area`) as the editor types, and
// still name what is already chosen: the lookup answers `?ids=` for those, whatever their status.

const STATUS_SUFFIX: Record<ContentStatus, string> = { published: '', draft: ' (skica)', archived: ' (arhivirano)' }

/** The label a menu shows: a row that is not Published says so, so a Draft or archived choice is not mistaken for a live one. */
export function lookupItemLabel(item: Pick<ContentLookupItem, 'label' | 'status'>) {
  return `${item.label}${STATUS_SUFFIX[item.status] ?? ''}`
}

const IDS_PER_REQUEST = 50

export function useAdminLookup(endpoint: string, options: { scope?: string, selected: () => readonly string[] }) {
  const $fetch = useEditorialFetch()
  const search = ref('')
  const known = ref<Record<string, string>>({})

  function remember(items: readonly ContentLookupItem[]) {
    for (const item of items) known.value[item.id] = lookupItemLabel(item)
  }

  const query = computed(() => ({ q: search.value.trim() || undefined, scope: options.scope }))
  const { data, status } = useFetch<{ items: ContentLookupItem[] }>(endpoint, { $fetch, query, server: false })
  watch(() => data.value?.items, items => remember(items ?? []), { immediate: true })

  // The labels of chosen rows the search does not show (the menu must still name them).
  async function resolve(ids: readonly string[]) {
    for (let from = 0; from < ids.length; from += IDS_PER_REQUEST) {
      try {
        const result = await $fetch<{ items: ContentLookupItem[] }>(endpoint, { query: { ids: ids.slice(from, from + IDS_PER_REQUEST).join(','), scope: options.scope } })
        remember(result.items)
      } catch {
        // The row stays unnamed; the menu shows a placeholder label for it.
      }
    }
  }
  if (import.meta.client) {
    watch(() => options.selected().filter(id => id && !(id in known.value)), (ids) => {
      if (ids.length) resolve(ids)
    }, { immediate: true })
  }

  const items = computed(() => {
    const found = (data.value?.items ?? []).map(item => ({ label: lookupItemLabel(item), value: item.id }))
    const present = new Set(found.map(item => item.value))
    const chosen = options.selected().filter(id => id && !present.has(id)).map(id => ({ label: known.value[id] ?? '…', value: id }))
    return [...chosen, ...found]
  })

  function labelOf(id: string) {
    return known.value[id] ?? '…'
  }

  return { search, items, labelOf, pending: computed(() => status.value === 'pending') }
}
