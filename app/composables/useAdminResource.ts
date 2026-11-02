import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import type {
  ContentEntity, ContentErrorData, ContentIssue, ContentKind, ContentList, ContentReferences, ContentStatus
} from '~~/shared/utils/content/common'
import { CONTENT_PAGE_SIZES, CONTENT_STATUSES, isUuid } from '~~/shared/utils/content/common'

// The client half of the admin CRUD kit. A page describes one resource with `defineAdminResource`
// (labels, columns, filters, form state and the shared validator) and hands it to
// <AdminResourcePage>; list state lives in the URL, and dialogs talk to the generic content API
// (/api/admin/content/:kind) through `useAdminContentApi`.

export interface AdminColumn {
  /** Entity field shown in the column; a `#<key>-cell` slot on <AdminResourcePage> overrides the cell. */
  key: string
  label: string
  /** Server sort key; the header becomes a sort button when set. */
  sort?: string
  /** Hide below this breakpoint to keep the table readable on phones. */
  hideBelow?: 'sm' | 'md' | 'lg'
}

export interface AdminFilter {
  key: string
  label: string
  options: Array<{ label: string, value: string }>
}

export interface AdminResource<T extends ContentEntity = ContentEntity, F extends object = Record<string, unknown>> {
  kind: ContentKind
  icon: string
  labels: {
    /** Plural page title, e.g. "Izvori". */
    title: string
    description?: string
    /** Dialog titles and the "new" button, e.g. "Novi izvor" / "Uredi izvor". */
    create: string
    edit: string
    /** Empty list text, e.g. "Još nema izvora." */
    empty: string
    search: string
  }
  columns: AdminColumn[]
  filters?: AdminFilter[]
  defaultSort: string
  /** A fresh form for "Novo". */
  blank(): F
  /** The form for an existing entity. */
  toForm(entity: T): F
  /** The shared validator's issues for a form state. */
  validate(form: F): ContentIssue[]
  /** How a row is named in titles, toasts and confirmations. */
  label(entity: T): string
  /** Public page of the entity, when it has one. */
  publicPath?(entity: T): string | undefined
}

export function defineAdminResource<T extends ContentEntity, F extends object>(resource: AdminResource<T, F>) {
  return resource
}

/** A normalized admin API failure: Croatian message, field issues and the 409 payloads. */
export interface AdminApiError extends ContentErrorData {
  statusCode: number
  message: string
}

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Prijava je istekla. Prijavi se ponovno.',
  403: 'Zahtjev je odbijen.',
  404: 'Zapis nije pronađen.',
  413: 'Zahtjev je prevelik.',
  429: 'Previše pokušaja. Pokušaj ponovno kasnije.',
  503: 'Baza podataka ili administracija nije postavljena na serveru.'
}

export function adminApiError(error: unknown): AdminApiError {
  const fetchError = error as { statusCode?: number, status?: number, data?: { data?: ContentErrorData } }
  const statusCode = fetchError?.statusCode ?? fetchError?.status ?? 0
  const data = fetchError?.data?.data ?? {}
  if (statusCode === 401 && import.meta.client) {
    const route = useRoute()
    navigateTo({ path: '/admin/prijava', query: { next: route.fullPath } })
  }
  return {
    ...data,
    statusCode,
    message: data.message || STATUS_MESSAGES[statusCode] || (statusCode ? 'Spremanje ili učitavanje nije uspjelo. Pokušaj ponovno.' : 'Server nije dostupan. Provjeri vezu i pokušaj ponovno.')
  }
}

/** Typed calls to the generic content API for one kind. */
export function useAdminContentApi<T extends ContentEntity>(kind: ContentKind) {
  const base = `/api/admin/content/${kind}`
  return {
    get: (id: string) => $fetch<{ entity: T, legacyIds: string[] }>(`${base}/${id}`),
    create: (body: object) => $fetch<{ entity: T }>(base, { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown> & { revision: number }) => $fetch<{ entity: T }>(`${base}/${id}`, { method: 'PATCH', body }),
    archive: (id: string) => $fetch<{ mode: 'archive', entity: T }>(`${base}/${id}`, { method: 'DELETE', query: { mode: 'archive' } }),
    remove: (id: string) => $fetch<{ mode: 'hard', id: string }>(`${base}/${id}`, { method: 'DELETE', query: { mode: 'hard' } }),
    references: (id: string) => $fetch<ContentReferences>(`${base}/${id}/references`)
  }
}

export interface AdminListState {
  q: string
  page: number
  size: number
  sort: string
  filters: Record<string, string | undefined>
}

/** Sorts the API accepts for every kind; the status and "changed" columns use them. */
export const ADMIN_COMMON_SORTS = ['status', 'updatedAt', 'createdAt']

function single(value: LocationQuery[string] | undefined) {
  return typeof value === 'string' ? value : undefined
}

/** Reads list state from the URL query; anything unknown falls back to the defaults. */
export function adminListState(query: LocationQuery, resource: AdminResource): AdminListState {
  const page = Number(single(query.page))
  const size = Number(single(query.size))
  const sort = single(query.sort) ?? ''
  const sortKeys = [...resource.columns.map(column => column.sort).filter(Boolean), ...ADMIN_COMMON_SORTS]
  const filters: Record<string, string | undefined> = {}
  for (const filter of [...(resource.filters ?? []), { key: 'status', options: CONTENT_STATUSES.map(value => ({ value })) }]) {
    const value = single(query[filter.key])
    filters[filter.key] = filter.options.some(option => option.value === value) ? value : undefined
  }
  return {
    q: (single(query.q) ?? '').slice(0, 100),
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
    size: (CONTENT_PAGE_SIZES as readonly number[]).includes(size) ? size : CONTENT_PAGE_SIZES[0],
    sort: sortKeys.includes(sort.replace(/^-/, '')) ? sort : resource.defaultSort,
    filters
  }
}

/**
 * List state in the URL (`q`, filters, `page`, `size`, `sort`), the list request that follows it,
 * and the dialog deep links (`?uredi=<uuid>`, `?novo=1&<field>=<prefill>`).
 */
export function useAdminResource<T extends ContentEntity, F extends object>(resource: AdminResource<T, F>) {
  const route = useRoute()
  const router = useRouter()
  const state = computed(() => adminListState(route.query, resource as unknown as AdminResource))

  function replaceQuery(patch: LocationQueryRaw) {
    const query = Object.fromEntries(Object.entries({ ...route.query, ...patch })
      .filter(([, value]) => value !== undefined && value !== null && value !== '')) as LocationQueryRaw
    return router.replace({ query })
  }

  /** Changing the search or a filter starts again from the first page. */
  function setQuery(patch: Partial<Pick<AdminListState, 'q' | 'size' | 'sort'>> & { filters?: Record<string, string | undefined> }) {
    const { filters, ...rest } = patch
    return replaceQuery({
      ...rest,
      ...filters,
      page: undefined,
      size: rest.size === CONTENT_PAGE_SIZES[0] ? undefined : rest.size,
      sort: rest.sort === resource.defaultSort ? undefined : rest.sort
    })
  }

  function setPage(page: number) {
    return replaceQuery({ page: page > 1 ? page : undefined })
  }

  function clear() {
    const reset: LocationQueryRaw = { q: undefined, page: undefined }
    for (const key of Object.keys(state.value.filters)) reset[key] = undefined
    return replaceQuery(reset)
  }

  const isFiltered = computed(() => !!state.value.q || Object.values(state.value.filters).some(Boolean))

  // Serialized first, so opening a dialog (another query key) does not refetch an unchanged list.
  const apiQueryKey = computed(() => {
    const { q, page, size, sort, filters } = state.value
    return JSON.stringify(Object.fromEntries(Object.entries({ q, page, size, sort, ...filters }).filter(([, value]) => value !== undefined && value !== '')))
  })
  const apiQuery = computed(() => JSON.parse(apiQueryKey.value) as Record<string, string | number>)

  const list = useFetch<ContentList<T>>(`/api/admin/content/${resource.kind}`, {
    query: apiQuery,
    server: false,
    // The request key must follow the kind, so two resources never share cached rows.
    key: `admin-content-${resource.kind}`
  })
  const listError = computed(() => list.error.value ? adminApiError(list.error.value) : null)

  const editId = computed(() => {
    const id = single(route.query.uredi)
    return isUuid(id) ? id : undefined
  })
  const creating = computed(() => single(route.query.novo) === '1')
  /** `?novo=1&title=…`: query values for fields of the blank form prefill it. */
  const prefill = computed(() => {
    const blank = resource.blank() as Record<string, unknown>
    return Object.fromEntries(Object.keys(blank)
      .map(key => [key, single(route.query[key])] as const)
      .filter(([key, value]) => value !== undefined && typeof blank[key] === 'string' && !(key in state.value.filters))) as Partial<F>
  })

  function openEdit(id: string) {
    return replaceQuery({ uredi: id, novo: undefined })
  }
  function openCreate() {
    return replaceQuery({ novo: '1', uredi: undefined })
  }
  function closeDialog() {
    const reset: LocationQueryRaw = { uredi: undefined, novo: undefined }
    for (const key of Object.keys(prefill.value)) reset[key] = undefined
    return replaceQuery(reset)
  }

  return {
    state, setQuery, setPage, clear, isFiltered,
    list, listError,
    editId, creating, prefill, openEdit, openCreate, closeDialog
  }
}

export const ADMIN_STATUS_COLORS: Record<ContentStatus, 'neutral' | 'success' | 'warning'> = {
  draft: 'warning',
  published: 'success',
  archived: 'neutral'
}
