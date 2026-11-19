<script setup lang="ts" generic="T extends ContentEntity, F extends object">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ContentEntity, ContentList, ContentStatus } from '~~/shared/utils/content/common'
import { CONTENT_PAGE_SIZES, CONTENT_STATUSES } from '~~/shared/utils/content/common'
import type { AdminFilter, AdminResource, AdminListState } from '~/composables/useAdminResource'
import type { BulkAction } from '~/components/admin/BulkActionBar.vue'
import type { PzFilterValue } from '~/components/pz/PzFilterBar.vue'

// One admin list page for a content resource (Popis resursa): filter bar, a table with selection and bulk actions,
// empty/loading/error states and the row menu, with create/edit and delete as the design describes them. List state and open
// editors live in the URL, so every view can be linked and survives a reload. The 15 resources differ only in columns and fields.
//
// Slots: `#fields="{ state, entity }"` (form fields), `#advanced` (extra "Napredno" fields) and
// `#<column key>-cell="{ row }"` to render a column's cell.
const props = defineProps<{
  resource: AdminResource<T, F>
}>()
defineSlots<{
  'toolbar'?(): unknown
  'fields'?(props: { state: F, entity: T | null }): unknown
  'advanced'?(props: { state: F, entity: T | null }): unknown
  'side'?(props: { state: F, entity: T | null }): unknown
  'dialog'?(props: {
    editId: string | undefined
    creating: boolean
    prefill: Partial<F>
    proposalId: number | undefined
    visible: boolean
    closeDialog: () => Promise<unknown>
    refresh: () => Promise<unknown>
  }): unknown
  'toolbar-after'?(props: { state: AdminListState, setQuery: (patch: Parameters<ReturnType<typeof useAdminResource>['setQuery']>[0]) => Promise<unknown> }): unknown
} & {
  [cell: `${string}-cell`]: ((props: { row: T }) => unknown) | undefined
}>()

const {
  state, setQuery, setPage, clear, isFiltered,
  list, listError,
  editId, creating, prefill, proposalId, openEdit, openCreate, closeDialog,
  historyId, openHistory, closeHistory
} = useAdminResource(props.resource)
const api = useAdminContentApi<T>(props.resource.kind)
const confirm = useAdminConfirm()
const chooseDelete = useAdminDeleteChoice()
const toast = useToast()
const route = useRoute()

const rows = computed(() => list.data.value?.rows ?? [])
const total = computed(() => list.data.value?.total ?? 0)
const loading = computed(() => list.status.value === 'pending' || list.status.value === 'idle')

// Search is typed freely and written to the URL after a pause.
const search = ref(state.value.q)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(() => state.value.q, (q) => {
  if (q !== search.value.trim()) search.value = q
})
watch(search, (value) => {
  clearTimeout(searchTimer)
  if (value.trim() === state.value.q) return
  searchTimer = setTimeout(() => setQuery({ q: value.trim() }), 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const STATUS_FILTER_LABEL = 'Stanje'
const filters = computed<AdminFilter[]>(() => [
  ...(props.resource.filters ?? []),
  { key: 'status', label: STATUS_FILTER_LABEL, options: CONTENT_STATUSES.map(value => ({ label: STATUS_LABELS[value], value })) }
])
const STATUS_LABELS: Record<ContentStatus, string> = { draft: 'Skica', published: 'Objavljeno', archived: 'Arhivirano' }

// The shared filter bar (search, selects, "Očisti", the count) over the URL state.
const filterModel = computed<PzFilterValue>({
  get: () => ({
    query: search.value,
    selects: Object.fromEntries(filters.value.map(filter => [filter.key, state.value.filters[filter.key] ?? ''])),
    quick: []
  }),
  set: (value) => {
    const cleared = !value.query && Object.values(value.selects).every(selected => !selected)
    if (cleared && isFiltered.value) {
      search.value = ''
      clear()
      return
    }
    if (value.query !== search.value) search.value = value.query
    for (const filter of filters.value) {
      const next = value.selects[filter.key] || undefined
      if (next !== state.value.filters[filter.key]) setQuery({ filters: { [filter.key]: next } })
    }
  }
})
const filterSelects = computed(() => filters.value.map(filter => ({ id: filter.key, label: filter.label, options: filter.options })))

const rowColumns = computed(() => props.resource.columns.map((column, index) => ({ ...column, main: index === 0 })))
const tableColumns = computed(() => [
  ...rowColumns.value,
  { key: 'status', label: STATUS_FILTER_LABEL, sort: 'status' },
  { key: 'updatedAt', label: 'Izmijenjeno', sort: 'updatedAt', hideBelow: 'md' as const }
])

function onSort(key: string) {
  const active = state.value.sort.replace(/^-/, '') === key
  const descending = active && state.value.sort.startsWith('-')
  setQuery({ sort: active && !descending ? `-${key}` : key })
}

function cellValue(entity: T, key: string) {
  const value = (entity as Record<string, unknown>)[key]
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

// A page past the end (after deleting its last row, or from an old link) moves to the last page.
watch([rows, total], () => {
  if (!loading.value && !rows.value.length && total.value > 0 && state.value.page > 1) {
    setPage(Math.ceil(total.value / state.value.size))
  }
})

const range = computed(() => {
  if (!total.value) return null
  const from = (state.value.page - 1) * state.value.size + 1
  return { from, to: Math.min(total.value, from + rows.value.length - 1) }
})
const pages = computed(() => Math.max(1, Math.ceil(total.value / state.value.size)))

// Selection survives paging: the ids are kept with the entities seen, so the bar can name them after the page changes.
const selected = ref<string[]>([])
const seen = new Map<string, T>()
watch(rows, (value) => {
  for (const row of value) seen.set(row.id, row)
}, { immediate: true })
const selectedEntities = computed(() => selected.value.map(id => seen.get(id)).filter((row): row is T => !!row))
function clearSelection() {
  selected.value = []
}
// Filters change what "all" means, so a new query starts from nothing selected.
watch(() => [state.value.q, JSON.stringify(state.value.filters)].join('|'), clearSelection)

// Row actions
const deleting = ref<T | null>(null) as Ref<T | null>
const deleteOpen = ref(false)

function askDelete(entity: T) {
  deleting.value = entity
  deleteOpen.value = true
}

async function archive(entity: T) {
  if (!await confirm({
    title: `Arhivirati „${props.resource.label(entity)}”?`,
    description: 'Zapis se više neće prikazivati javno. Poveznice i povijest ostaju, a možeš ga vratiti u skice.',
    confirmLabel: 'Arhiviraj'
  })) return
  try {
    await api.archive(entity.id)
    toast.add({ title: 'Arhivirano', description: props.resource.label(entity), color: 'success', icon: 'i-lucide-archive' })
  } catch (error) {
    toast.add({ title: 'Arhiviranje nije uspjelo', description: adminApiError(error).message, color: 'error' })
  }
  await list.refresh()
}

async function restore(entity: T) {
  try {
    await api.update(entity.id, { status: 'draft', revision: entity.revision })
    toast.add({ title: 'Vraćeno u skice', description: props.resource.label(entity), color: 'success', icon: 'i-lucide-archive-restore' })
  } catch (error) {
    toast.add({ title: 'Vraćanje nije uspjelo', description: adminApiError(error).message, color: 'error' })
  }
  await list.refresh()
}

async function refresh() {
  await list.refresh()
}

function rowActions(entity: T): DropdownMenuItem[][] {
  const publicPath = entity.status === 'published' ? props.resource.publicPath?.(entity) : undefined
  const extra = props.resource.rowActions?.(entity, { refresh }) ?? []
  // A locked row keeps both actions visible, disabled, with the reason.
  const locked = props.resource.lockedReason?.(entity)
  const lock = locked ? { disabled: true, description: locked } : {}
  return [
    [
      { label: 'Uredi', icon: 'i-lucide-pencil', onSelect: () => openEdit(entity.id) },
      ...(publicPath ? [{ label: 'Pogledaj na stranici', icon: 'i-lucide-external-link', to: publicPath, target: '_blank' }] : []),
      { label: 'Povijest izmjena', icon: 'i-lucide-history', onSelect: () => openHistory(entity.id) }
    ],
    ...(extra.length ? [extra] : []),
    [entity.status === 'archived'
      ? { label: 'Vrati u skice', icon: 'i-lucide-archive-restore', onSelect: () => restore(entity) }
      : { label: 'Arhiviraj', icon: 'i-lucide-archive', onSelect: () => archive(entity), ...lock }],
    [{ label: 'Izbriši zapis', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => askDelete(entity), ...lock }]
  ]
}

// Bulk actions: each record is its own request, so one that fails (a missing settlement, a record that others refer to) is
// reported with its reason while the rest go through. Progress and the result are announced through a live region.
type BulkKey = 'publish' | 'archive' | 'verify' | 'delete'
interface BulkFailure {
  entity: T
  reason: string
}
const running = ref<{ label: string, done: number, total: number } | null>(null)
const result = ref<{ message: string, ok: number, failed: BulkFailure[], verb: string } | null>(null)
const showFailed = ref(false)
const announcement = ref('')
let stopRequested = false

const verificationFilter = computed(() => props.resource.filters?.find(filter => filter.key === 'verification'))
const bulkActions = computed<BulkAction[]>(() => [
  { key: 'publish', label: 'Objavi' },
  { key: 'archive', label: 'Arhiviraj' },
  ...(verificationFilter.value ? [{ key: 'verify', label: 'Promijeni provjeru', items: verificationFilter.value.options }] : []),
  { key: 'delete', label: 'Izbriši' }
])

const agree = (count: number, forms: [string, string, string]) => nounFor(count, forms)
const VERBS: Record<BulkKey, { running: string, done: [string, string, string] }> = {
  publish: { running: 'Objavljujem…', done: ['Objavljen', 'Objavljena', 'Objavljeno'] },
  archive: { running: 'Arhiviram…', done: ['Arhiviran', 'Arhivirana', 'Arhivirano'] },
  verify: { running: 'Mijenjam provjeru…', done: ['Promijenjena provjera na', 'Promijenjena provjera na', 'Promijenjena provjera na'] },
  delete: { running: 'Brišem…', done: ['Izbrisan', 'Izbrisana', 'Izbrisano'] }
}

async function runBulk(key: BulkKey, entities: T[], step: (entity: T) => Promise<void>) {
  result.value = null
  showFailed.value = false
  stopRequested = false
  const failed: BulkFailure[] = []
  let ok = 0
  running.value = { label: VERBS[key].running, done: 0, total: entities.length }
  for (const entity of entities) {
    if (stopRequested) break
    try {
      await step(entity)
      ok++
    } catch (error) {
      failed.push({ entity, reason: adminApiError(error).message })
    }
    running.value = { ...running.value!, done: running.value!.done + 1 }
    announcement.value = `${VERBS[key].running} ${running.value.done} od ${entities.length}`
  }
  running.value = null
  const verb = agree(ok, VERBS[key].done)
  const done = `${verb} ${ok} ${nounFor(ok, ['zapis', 'zapisa', 'zapisa'])}`
  const message = failed.length ? `${done}, ${failed.length} ${failed.length === 1 ? 'nije' : 'nisu'}` : done
  announcement.value = message
  if (failed.length) result.value = { message, ok, failed, verb }
  else toast.add({ title: message, color: 'success', icon: 'i-lucide-check' })
  clearSelection()
  await list.refresh()
}

// "Odaberi svih N": the matching records beyond this page, fetched with the same filters.
async function selectAllMatching() {
  const ids = new Set(selected.value)
  const query = { ...Object.fromEntries(Object.entries({ q: state.value.q || undefined, sort: state.value.sort, ...state.value.filters }).filter(([, value]) => value !== undefined)), size: 100 }
  try {
    for (let page = 1; page <= Math.ceil(total.value / 100) && page <= 20; page++) {
      const batch = await $fetch<ContentList<T>>(`/api/admin/content/${props.resource.kind}`, { query: { ...query, page } })
      for (const row of batch.rows) {
        seen.set(row.id, row)
        ids.add(row.id)
      }
    }
    selected.value = [...ids]
  } catch (error) {
    toast.add({ title: 'Nismo uspjeli odabrati sve zapise', description: adminApiError(error).message, color: 'error' })
  }
}

async function onBulkAction(action: string) {
  const [key, value] = action.split(':') as [BulkKey, string | undefined]
  const entities = selectedEntities.value
  if (!entities.length) return
  if (key === 'publish') return runBulk(key, entities, async (entity) => {
    await api.update(entity.id, { status: 'published', revision: entity.revision })
  })
  if (key === 'archive') return runBulk(key, entities, async (entity) => {
    await api.archive(entity.id)
  })
  if (key === 'verify' && value) {
    const label = verificationFilter.value?.options.find(option => option.value === value)?.label ?? value
    VERBS.verify.done = [`Provjera promijenjena na „${label}”:`, `Provjera promijenjena na „${label}”:`, `Provjera promijenjena na „${label}”:`]
    return runBulk(key, entities, async (entity) => {
      await api.update(entity.id, { verification: value, revision: entity.revision })
    })
  }
  if (key === 'delete') {
    const names = entities.slice(0, 1).map(entity => `„${props.resource.label(entity)}”`)
    const rest = entities.length - 1
    const choice = await chooseDelete({
      title: `Želiš li izbrisati ${entities.length} ${nounFor(entities.length, ['zapis', 'zapisa', 'zapisa'])}?`,
      description: `Izbrisat će se ${names[0]}${rest > 0 ? ` i još ${rest} ${nounFor(rest, ['zapis', 'zapisa', 'zapisa'])}` : ''}, zajedno s poviješću izmjena. Ovo se ne može poništiti. Ako ${entities.length === 1 ? 'ga' : 'ih'} samo želiš maknuti sa stranice, arhiviraj ${entities.length === 1 ? 'ga' : 'ih'}.`,
      deleteLabel: entities.length === 1 ? 'Izbriši zapis' : `Izbriši ${entities.length} ${nounFor(entities.length, ['zapis', 'zapisa', 'zapisa'])}`,
      archiveLabel: 'Arhiviraj umjesto toga'
    })
    if (choice === 'archive') return runBulk('archive', entities, async (entity) => {
      await api.archive(entity.id)
    })
    if (choice === 'delete') return runBulk('delete', entities, async (entity) => {
      await api.remove(entity.id)
    })
  }
}

const failedEditorLink = (entity: T) => ({ query: { ...route.query, uredi: entity.id, novo: undefined, povijest: undefined } })

// The editor: a page in place of the list for the main resources, a dialog for the short lookup lists.
const pageEditor = computed(() => props.resource.editor === 'page')
const dialogOpen = computed({
  get: () => !!editId.value || creating.value,
  set: (value) => {
    if (!value) closeDialog()
  }
})

// The drawer stays mounted after closing, so it can slide out before it is forgotten.
const historyOpen = computed({
  get: () => !!historyId.value,
  set: (value) => {
    if (!value) closeHistory()
  }
})
const shownHistoryId = ref(historyId.value)
watch(historyId, (id) => {
  if (id) shownHistoryId.value = id
})

const pageSizes = CONTENT_PAGE_SIZES.map(value => ({ label: `${value} po stranici`, value: value as number }))
const emptyTitle = computed(() => isFiltered.value ? 'Nema zapisa za ove filtre' : props.resource.labels.empty)
</script>

<template>
  <AdminPanel
    :title="resource.labels.title"
    :icon="resource.icon"
  >
    <template #actions>
      <UButton
        v-if="!(pageEditor && dialogOpen)"
        :label="resource.labels.create"
        icon="i-lucide-plus"
        data-test="admin-create"
        @click="openCreate"
      />
    </template>

    <template v-if="!(pageEditor && dialogOpen && !$slots.dialog)">
      <p
        v-if="resource.labels.description"
        class="text-muted"
      >
        {{ resource.labels.description }}
      </p>

      <slot name="toolbar" />

      <AdminBulkActionBar
        v-if="selected.length || running"
        :count="selected.length"
        :actions="bulkActions"
        :running="running ?? undefined"
        :total-matching="total"
        @action="onBulkAction"
        @clear="clearSelection"
        @stop="stopRequested = true"
        @select-all="selectAllMatching"
      />
      <PzFilterBar
        v-else
        v-model="filterModel"
        :selects="filterSelects"
        :count="total"
        :search-label="resource.labels.search"
        :search-placeholder="resource.labels.search"
        search-shortcut
      />

      <slot
        name="toolbar-after"
        :state="state"
        :set-query="setQuery"
      />

      <p
        class="sr-only"
        role="status"
        aria-live="polite"
        data-testid="admin-bulk-live"
      >
        {{ announcement }}
      </p>

      <UAlert
        v-if="result"
        color="warning"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="result.message"
        :actions="[{ label: showFailed ? `Sakrij ${result.failed.length === 1 ? 'taj zapis' : `ta ${result.failed.length} zapisa`}` : `Prikaži ${result.failed.length === 1 ? 'taj zapis' : `ta ${result.failed.length} zapisa`}`, color: 'neutral', variant: 'outline', onClick: () => { showFailed = !showFailed } }]"
        role="alert"
        data-testid="admin-bulk-result"
      >
        <template #description>
          <ul
            v-if="showFailed"
            class="mt-2 list-disc ps-5"
          >
            <li
              v-for="failure in result.failed"
              :key="failure.entity.id"
            >
              <NuxtLink
                :to="failedEditorLink(failure.entity as T)"
                class="font-bold underline underline-offset-2"
              >
                {{ resource.label(failure.entity as T) }}
              </NuxtLink>: {{ failure.reason }}
            </li>
          </ul>
          <template v-else>
            {{ result.failed[0]?.reason }}
          </template>
        </template>
      </UAlert>

      <UAlert
        v-if="listError"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Popis nismo uspjeli učitati"
        :description="`${listError.message} Provjeri vezu i pokušaj ponovno. Ništa nije izgubljeno.`"
        :actions="[{ label: 'Pokušaj ponovno', color: 'neutral', variant: 'outline', onClick: () => list.refresh() }]"
        role="alert"
      />

      <section
        v-else-if="!loading && !rows.length"
        class="flex flex-col items-start gap-3 rounded-lg border border-default bg-default p-6"
        data-test="admin-empty"
      >
        <UIcon
          :name="isFiltered ? 'i-lucide-search-x' : resource.icon"
          class="size-8 text-muted"
          aria-hidden="true"
        />
        <h2 class="pz-h3 text-highlighted">
          {{ emptyTitle }}
        </h2>
        <p class="max-w-[60ch] text-muted">
          {{ isFiltered ? 'Promijeni upit ili očisti filtre.' : 'Prvi zapis možeš unijeti odmah ili ga preuzeti iz zaprimljenih priloga.' }}
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="isFiltered"
            label="Očisti"
            color="neutral"
            variant="outline"
            @click="clear"
          />
          <template v-else>
            <UButton
              :label="resource.labels.create"
              icon="i-lucide-plus"
              @click="openCreate"
            />
            <UButton
              label="Otvori Prijedloge"
              color="neutral"
              variant="outline"
              to="/admin/prijedlozi"
            />
          </template>
        </div>
      </section>

      <template v-else>
        <p
          v-if="loading"
          class="sr-only"
          role="status"
        >
          Učitavanje zapisa…
        </p>
        <AdminDataTable
          v-model:selected="selected"
          :columns="tableColumns"
          :rows="rows"
          :caption="resource.labels.title"
          :row-label="(row: T) => resource.label(row)"
          :sort="state.sort"
          :loading="loading"
          selectable
          :row-href="row => `?uredi=${row.id}`"
          @sort="onSort"
          @open="row => openEdit(row.id)"
        >
          <template
            v-for="column in resource.columns"
            :key="column.key"
            #[`cell-${column.key}`]="{ row }"
          >
            <button
              v-if="column.key === resource.columns[0]?.key"
              type="button"
              class="text-start font-bold text-highlighted hover:underline"
              @click="openEdit(row.id)"
            >
              <slot
                :name="`${column.key}-cell`"
                :row="row as T"
              >
                {{ cellValue(row as T, column.key) }}
              </slot>
            </button>
            <slot
              v-else
              :name="`${column.key}-cell`"
              :row="row as T"
            >
              <AdminVerificationCell
                v-if="column.key === 'verification'"
                :value="(row as Record<string, unknown>).verification as string"
              />
              <span v-else>{{ cellValue(row as T, column.key) }}</span>
            </slot>
          </template>
          <template #cell-status="{ row }">
            <slot
              name="status-cell"
              :row="row"
            >
              <PzStatusBadge :status="row.status" />
            </slot>
          </template>
          <template #cell-updatedAt="{ row }">
            <span class="text-sm text-muted tabular-nums">{{ shortDate(row.updatedAt) }}</span>
          </template>
          <template #actions="{ row }">
            <UDropdownMenu
              :items="rowActions(row as T)"
              :content="{ align: 'end' }"
            >
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                :aria-label="`Radnje: ${resource.label(row as T)}`"
              />
            </UDropdownMenu>
          </template>
        </AdminDataTable>
      </template>

      <div
        v-if="total > 0"
        class="flex flex-wrap items-center justify-between gap-3"
      >
        <span class="text-sm text-muted">
          {{ range?.from }} do {{ range?.to }} od {{ total }}<span class="max-sm:hidden"> · Stranica {{ state.page }} od {{ pages }}</span>
        </span>
        <div class="flex flex-wrap items-center gap-3">
          <USelect
            :model-value="state.size"
            :items="pageSizes"
            aria-label="Broj zapisa po stranici"
            class="w-40"
            @update:model-value="value => setQuery({ size: Number(value) })"
          />
          <UPagination
            :page="state.page"
            :total="total"
            :items-per-page="state.size"
            @update:page="setPage"
          />
        </div>
      </div>
    </template>

    <AdminEntityDialog
      v-if="!$slots.dialog"
      v-model:open="dialogOpen"
      :mode="pageEditor ? 'page' : 'dialog'"
      :resource="resource"
      :entity-id="editId"
      :prefill="creating ? prefill : undefined"
      :proposal-id="proposalId"
      @saved="list.refresh()"
    >
      <template #fields="fieldProps">
        <slot
          name="fields"
          v-bind="fieldProps"
        />
      </template>
      <template
        v-if="$slots.advanced"
        #advanced="fieldProps"
      >
        <slot
          name="advanced"
          v-bind="fieldProps"
        />
      </template>
      <template
        v-if="$slots.side"
        #side="fieldProps"
      >
        <slot
          name="side"
          v-bind="fieldProps"
        />
      </template>
    </AdminEntityDialog>
    <slot
      v-else
      name="dialog"
      :edit-id="editId"
      :creating="creating"
      :prefill="prefill"
      :proposal-id="proposalId"
      :visible="dialogOpen"
      :close-dialog="closeDialog"
      :refresh="() => list.refresh()"
    />

    <AdminHistoryDrawer
      v-if="shownHistoryId"
      v-model:open="historyOpen"
      :kind="resource.kind"
      :entity-id="shownHistoryId"
      @restored="list.refresh()"
    />

    <AdminDeleteDialog
      v-model:open="deleteOpen"
      :resource="resource"
      :entity="deleting"
      @done="list.refresh()"
    />
  </AdminPanel>
</template>
