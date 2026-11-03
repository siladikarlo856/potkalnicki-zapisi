<script setup lang="ts" generic="T extends ContentEntity, F extends object">
import { h, resolveComponent } from 'vue'
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { ContentEntity } from '~~/shared/utils/content/common'
import { CONTENT_PAGE_SIZES, CONTENT_STATUSES, CONTENT_STATUS_LABELS } from '~~/shared/utils/content/common'
import type { AdminFilter, AdminResource } from '~/composables/useAdminResource'

// One admin list page for a content resource: search, filters, sortable columns, pagination,
// empty/loading/error states and the row menu, with create/edit and delete in dialogs. List state
// and open dialogs live in the URL, so every view can be linked and survives a reload.
//
// Slots: `#fields="{ state, entity }"` (form fields), `#advanced` (extra "Napredno" fields) and
// `#<column key>-cell="{ row }"` to render a column's cell.
const props = defineProps<{
  resource: AdminResource<T, F>
}>()
defineSlots<{
  fields?(props: { state: F, entity: T | null }): unknown
  advanced?(props: { state: F, entity: T | null }): unknown
} & {
  [cell: `${string}-cell`]: ((props: { row: T }) => unknown) | undefined
}>()

const UButton = resolveComponent('UButton')
const {
  state, setQuery, setPage, clear, isFiltered,
  list, listError,
  editId, creating, prefill, openEdit, openCreate, closeDialog,
  historyId, openHistory, closeHistory
} = useAdminResource(props.resource)
const api = useAdminContentApi<T>(props.resource.kind)
const confirm = useAdminConfirm()
const toast = useToast()

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

const filters = computed<AdminFilter[]>(() => [
  ...(props.resource.filters ?? []),
  { key: 'status', label: 'Status', options: CONTENT_STATUSES.map(value => ({ label: CONTENT_STATUS_LABELS[value], value })) }
])

function sortHeader(label: string, key: string) {
  const active = state.value.sort.replace(/^-/, '') === key
  const descending = active && state.value.sort.startsWith('-')
  return h(UButton, {
    'color': 'neutral',
    'variant': 'ghost',
    label,
    'icon': active ? (descending ? 'i-lucide-arrow-down-wide-narrow' : 'i-lucide-arrow-up-narrow-wide') : 'i-lucide-arrow-up-down',
    'class': '-mx-2.5',
    'aria-label': `${label}: poredaj ${active && !descending ? 'silazno' : 'uzlazno'}`,
    'onClick': () => setQuery({ sort: active && !descending ? `-${key}` : key })
  })
}

const HIDE_BELOW = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' } as const

const columns = computed<TableColumn<T>[]>(() => [
  ...props.resource.columns.map((column, index) => ({
    id: column.key,
    header: column.sort ? () => sortHeader(column.label, column.sort!) : column.label,
    meta: {
      class: {
        th: column.hideBelow ? HIDE_BELOW[column.hideBelow] : '',
        // The naming column wraps, so status and the row menu stay on screen.
        td: [column.hideBelow ? HIDE_BELOW[column.hideBelow] : '', index === 0 ? 'min-w-48 whitespace-normal' : ''].join(' ').trim()
      }
    }
  })),
  { id: 'status', header: () => sortHeader('Status', 'status') },
  { id: 'updatedAt', header: () => sortHeader('Izmijenjeno', 'updatedAt'), meta: { class: { th: HIDE_BELOW.md, td: HIDE_BELOW.md } } },
  { id: 'actions', header: () => h('span', { class: 'sr-only' }, 'Radnje'), meta: { class: { th: 'w-12', td: 'w-12' } } }
])

function cellValue(entity: T, key: string) {
  const value = (entity as Record<string, unknown>)[key]
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric' })
}

// A page past the end (after deleting its last row, or from an old link) moves to the last page.
watch([rows, total], () => {
  if (!loading.value && !rows.value.length && total.value > 0 && state.value.page > 1) {
    setPage(Math.ceil(total.value / state.value.size))
  }
})

const showing = computed(() => {
  if (!total.value) return ''
  const from = (state.value.page - 1) * state.value.size + 1
  const to = Math.min(total.value, from + rows.value.length - 1)
  return `${from}–${to} od ${total.value}`
})

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
    description: 'Zapis se više neće prikazivati javno. Poveznice i povijest ostaju, a možeš ga vratiti iz arhive.',
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
    await api.update(entity.id, { status: 'published', revision: entity.revision })
    toast.add({ title: 'Vraćeno iz arhive', description: props.resource.label(entity), color: 'success', icon: 'i-lucide-archive-restore' })
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
      { label: 'Povijest', icon: 'i-lucide-history', onSelect: () => openHistory(entity.id) },
      ...(publicPath ? [{ label: 'Otvori javno', icon: 'i-lucide-external-link', to: publicPath, target: '_blank' }] : [])
    ],
    ...(extra.length ? [extra] : []),
    [entity.status === 'archived'
      ? { label: 'Vrati iz arhive', icon: 'i-lucide-archive-restore', onSelect: () => restore(entity) }
      : { label: 'Arhiviraj', icon: 'i-lucide-archive', onSelect: () => archive(entity), ...lock }],
    [{ label: 'Obriši', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => askDelete(entity), ...lock }]
  ]
}

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
</script>

<template>
  <AdminPanel
    :title="resource.labels.title"
    :icon="resource.icon"
  >
    <template #actions>
      <UButton
        :label="resource.labels.create"
        icon="i-lucide-plus"
        data-test="admin-create"
        @click="openCreate"
      />
    </template>

    <p
      v-if="resource.labels.description"
      class="text-muted"
    >
      {{ resource.labels.description }}
    </p>

    <div
      class="flex flex-wrap items-center gap-2"
      role="search"
    >
      <UInput
        v-model="search"
        icon="i-lucide-search"
        :placeholder="resource.labels.search"
        :aria-label="resource.labels.search"
        class="w-full sm:w-72"
        data-test="admin-search"
      />
      <USelect
        v-for="filter in filters"
        :key="filter.key"
        :model-value="state.filters[filter.key]"
        :items="filter.options"
        :placeholder="`${filter.label}: sve`"
        :aria-label="filter.label"
        class="min-w-40"
        @update:model-value="value => setQuery({ filters: { [filter.key]: value as string } })"
      />
      <UButton
        v-if="isFiltered"
        label="Očisti"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        @click="clear"
      />
      <span class="ms-auto text-sm text-muted">
        {{ total }} {{ total % 10 === 1 && total % 100 !== 11 ? 'zapis' : 'zapisa' }}
      </span>
    </div>

    <UAlert
      v-if="listError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="listError.message"
      :actions="[{ label: 'Pokušaj ponovno', color: 'neutral', variant: 'outline', onClick: () => list.refresh() }]"
      role="alert"
    />

    <UEmpty
      v-else-if="!loading && !rows.length"
      :icon="isFiltered ? 'i-lucide-search-x' : resource.icon"
      :title="isFiltered ? 'Nema rezultata' : resource.labels.empty"
      :description="isFiltered ? 'Promijeni pretragu ili filtre.' : undefined"
      :actions="isFiltered
        ? [{ label: 'Očisti', color: 'neutral', variant: 'outline', onClick: clear }]
        : [{ label: resource.labels.create, icon: 'i-lucide-plus', onClick: openCreate }]"
      data-test="admin-empty"
    />

    <UTable
      v-else
      :data="rows"
      :columns="columns"
      :loading="loading"
      :get-row-id="row => row.id"
      :caption="resource.labels.title"
      class="rounded-lg ring ring-default"
      :ui="{ tr: 'cursor-pointer' }"
      data-test="admin-table"
      @select="(_event, row) => openEdit(row.original.id)"
    >
      <template
        v-for="(column, index) in resource.columns"
        :key="column.key"
        #[`${column.key}-cell`]="{ row }"
      >
        <slot
          :name="`${column.key}-cell`"
          :row="row.original"
        >
          <button
            v-if="index === 0"
            type="button"
            class="text-left font-medium text-highlighted hover:underline"
            @click.stop="openEdit(row.original.id)"
          >
            {{ cellValue(row.original, column.key) }}
          </button>
          <span v-else>{{ cellValue(row.original, column.key) }}</span>
        </slot>
      </template>
      <template #status-cell="{ row }">
        <UBadge
          :label="CONTENT_STATUS_LABELS[row.original.status]"
          :color="ADMIN_STATUS_COLORS[row.original.status]"
          variant="subtle"
        />
      </template>
      <template #updatedAt-cell="{ row }">
        <span class="text-sm text-dimmed">{{ formatDate(row.original.updatedAt) }}</span>
      </template>
      <template #actions-cell="{ row }">
        <div
          class="flex justify-end"
          @click.stop
        >
          <UDropdownMenu
            :items="rowActions(row.original)"
            :content="{ align: 'end' }"
          >
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="ghost"
              :aria-label="`Radnje: ${resource.label(row.original)}`"
            />
          </UDropdownMenu>
        </div>
      </template>
    </UTable>

    <div
      v-if="total > 0"
      class="flex flex-wrap items-center justify-between gap-3"
    >
      <span class="text-sm text-muted">{{ showing }}</span>
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

    <AdminEntityDialog
      v-model:open="dialogOpen"
      :resource="resource"
      :entity-id="editId"
      :prefill="creating ? prefill : undefined"
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
    </AdminEntityDialog>

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
