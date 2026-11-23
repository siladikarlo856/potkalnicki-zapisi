<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { LocationQueryRaw } from 'vue-router'
import { CONTENT_PAGE_SIZES, isContentKind, isUuid } from '~~/shared/utils/content/common'
import type { HistoryAction, HistoryLog, HistoryLogRow } from '~~/shared/utils/content/history'
import {
  HISTORY_ACTIONS, HISTORY_ACTION_LABELS, HISTORY_ACTORS, HISTORY_ACTOR_LABELS, HISTORY_KINDS, HISTORY_KIND_META, isHistoryKind
} from '~~/shared/utils/content/history'

const $fetch = useEditorialFetch()

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Povijest', robots: 'noindex, nofollow' })

// The change log across all content: every write the database recorded, newest first, filterable
// by kind, action and author. Rows of kinds with an admin resource open that row's history drawer
// (`?zapis=<kind>:<uuid>`), where an earlier version can be restored; filters and page are in the URL.
const route = useRoute()
const router = useRouter()

function single(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

const state = computed(() => {
  const kind = single(route.query.vrsta)
  const action = single(route.query.radnja)
  const actor = single(route.query.autor)
  const page = Number(single(route.query.page))
  const size = Number(single(route.query.size))
  return {
    kind: isHistoryKind(kind) ? kind : undefined,
    action: (HISTORY_ACTIONS as readonly string[]).includes(action ?? '') ? action as HistoryAction : undefined,
    actor: (HISTORY_ACTORS as readonly string[]).includes(actor ?? '') ? actor : undefined,
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
    size: (CONTENT_PAGE_SIZES as readonly number[]).includes(size) ? size : CONTENT_PAGE_SIZES[0]
  }
})

function replaceQuery(patch: LocationQueryRaw) {
  const query = Object.fromEntries(Object.entries({ ...route.query, ...patch })
    .filter(([, value]) => value !== undefined && value !== null && value !== '')) as LocationQueryRaw
  return router.replace({ query })
}

function setFilter(key: 'vrsta' | 'radnja' | 'autor', value: unknown) {
  return replaceQuery({ [key]: typeof value === 'string' ? value : undefined, page: undefined })
}

const apiQuery = computed(() => Object.fromEntries(Object.entries({
  kind: state.value.kind,
  action: state.value.action,
  actor: state.value.actor,
  page: state.value.page,
  size: state.value.size
}).filter(([, value]) => value !== undefined)) as Record<string, string | number>)

const log = useFetch<HistoryLog>('/api/admin/history', { $fetch, query: apiQuery, server: false, key: 'admin-history-log' })
const rows = computed(() => log.data.value?.rows ?? [])
const total = computed(() => log.data.value?.total ?? 0)
const loading = computed(() => log.status.value === 'pending' || log.status.value === 'idle')
const listError = computed(() => log.error.value ? adminApiError(log.error.value) : null)
const isFiltered = computed(() => !!(state.value.kind || state.value.action || state.value.actor))

// A page past the end (from an old link) moves to the last page.
watch([rows, total], () => {
  if (!loading.value && !rows.value.length && total.value > 0 && state.value.page > 1) {
    replaceQuery({ page: String(Math.ceil(total.value / state.value.size)) })
  }
})

const showing = computed(() => {
  if (!total.value) return ''
  const from = (state.value.page - 1) * state.value.size + 1
  return `${from}–${Math.min(total.value, from + rows.value.length - 1)} od ${total.value}`
})

const kindOptions = HISTORY_KINDS.map(value => ({ label: HISTORY_KIND_META[value].plural, value }))
const actionOptions = HISTORY_ACTIONS.map(value => ({ label: HISTORY_ACTION_LABELS[value], value }))
const actorOptions = HISTORY_ACTORS.map(value => ({ label: HISTORY_ACTOR_LABELS[value], value: value as string }))
function setSize(value: unknown) {
  return replaceQuery({ size: Number(value) === CONTENT_PAGE_SIZES[0] ? undefined : String(value), page: undefined })
}

const pageSizes = CONTENT_PAGE_SIZES.map(value => ({ label: `${value} po stranici`, value: value as number }))

const HIDE = { md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' } as const
const columns: TableColumn<HistoryLogRow>[] = [
  { id: 'createdAt', header: 'Vrijeme' },
  { id: 'label', header: 'Zapis', meta: { class: { td: 'min-w-48 whitespace-normal' } } },
  { id: 'action', header: 'Radnja' },
  { id: 'revision', header: 'Revizija', meta: { class: { th: HIDE.md, td: HIDE.md } } },
  { id: 'actor', header: 'Autor', meta: { class: { th: HIDE.lg, td: HIDE.lg } } }
]

/** Croatian plural of "izmjena" for a count: 1 izmjena, 2–4 izmjene, otherwise izmjena. */
function changeNoun(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) return 'izmjena'
  return count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'izmjene' : 'izmjena'
}

const ACTION_COLORS = { insert: 'success', update: 'info', delete: 'error' } as const

function formatDate(value: string) {
  return new Date(value).toLocaleString('hr-HR', { dateStyle: 'medium', timeStyle: 'short' })
}

// The drawer: `?zapis=<kind>:<uuid>`; only kinds with an admin resource have one.
const opened = computed(() => {
  const [kind, id] = (single(route.query.zapis) ?? '').split(':')
  return isContentKind(kind) && isUuid(id) ? { kind, id: id.toLowerCase() } : undefined
})
const shown = ref(opened.value)
watch(opened, (value) => {
  if (value) shown.value = value
})
const drawerOpen = computed({
  get: () => !!opened.value,
  set: (value) => {
    if (!value) replaceQuery({ zapis: undefined })
  }
})

function openRow(row: HistoryLogRow) {
  if (row.registered) replaceQuery({ zapis: `${row.kind}:${row.entityId}` })
}
</script>

<template>
  <AdminPanel
    title="Povijest"
    icon="i-lucide-history"
  >
    <p class="text-muted">
      Svaka izmjena sadržaja ostaje zabilježena. Otvori zapis da vidiš što se promijenilo i da vratiš raniju verziju; i obrisani se zapis može vratiti.
    </p>

    <div
      class="flex flex-wrap items-center gap-2"
      role="search"
    >
      <USelect
        :model-value="state.kind"
        :items="kindOptions"
        placeholder="Vrsta: sve"
        aria-label="Vrsta zapisa"
        class="min-w-40"
        @update:model-value="value => setFilter('vrsta', value)"
      />
      <USelect
        :model-value="state.action"
        :items="actionOptions"
        placeholder="Radnja: sve"
        aria-label="Radnja"
        class="min-w-40"
        @update:model-value="value => setFilter('radnja', value)"
      />
      <USelect
        :model-value="state.actor"
        :items="actorOptions"
        placeholder="Autor: svi"
        aria-label="Autor"
        class="min-w-40"
        @update:model-value="value => setFilter('autor', value)"
      />
      <UButton
        v-if="isFiltered"
        label="Očisti"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        @click="replaceQuery({ vrsta: undefined, radnja: undefined, autor: undefined, page: undefined })"
      />
      <span class="ms-auto text-sm text-muted">{{ total }} {{ changeNoun(total) }}</span>
    </div>

    <UAlert
      v-if="listError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="listError.message"
      :actions="[{ label: 'Pokušaj ponovno', color: 'neutral', variant: 'outline', onClick: () => log.refresh() }]"
      role="alert"
    />

    <UEmpty
      v-else-if="!loading && !rows.length"
      :icon="isFiltered ? 'i-lucide-search-x' : 'i-lucide-history'"
      :title="isFiltered ? 'Nema rezultata' : 'Još nema zabilježenih izmjena.'"
      :description="isFiltered ? 'Promijeni filtre.' : undefined"
      :actions="isFiltered ? [{ label: 'Očisti', color: 'neutral', variant: 'outline', onClick: () => replaceQuery({ vrsta: undefined, radnja: undefined, autor: undefined, page: undefined }) }] : undefined"
      data-test="admin-empty"
    />

    <UTable
      v-else
      :data="rows"
      :columns="columns"
      :loading="loading"
      :get-row-id="row => String(row.id)"
      caption="Povijest izmjena"
      class="rounded-lg ring ring-default"
      data-test="history-log"
      @select="(_event, row) => openRow(row.original)"
    >
      <template #createdAt-cell="{ row }">
        <time
          :datetime="row.original.createdAt"
          class="text-sm text-muted"
        >{{ formatDate(row.original.createdAt) }}</time>
      </template>
      <template #label-cell="{ row }">
        <div class="flex flex-col items-start gap-0.5">
          <button
            v-if="row.original.registered"
            type="button"
            class="text-left font-medium text-highlighted hover:underline"
            @click.stop="openRow(row.original)"
          >
            {{ row.original.label }}
          </button>
          <span
            v-else
            class="font-medium text-highlighted"
          >{{ row.original.label }}</span>
          <span class="text-xs text-muted">{{ HISTORY_KIND_META[row.original.kind].singular }}</span>
        </div>
      </template>
      <template #action-cell="{ row }">
        <UBadge
          :label="HISTORY_ACTION_LABELS[row.original.action]"
          :color="ACTION_COLORS[row.original.action]"
          variant="subtle"
        />
      </template>
      <template #revision-cell="{ row }">
        <span class="text-sm text-muted">{{ row.original.revision }}</span>
      </template>
      <template #actor-cell="{ row }">
        <span class="text-sm text-muted">{{ HISTORY_ACTOR_LABELS[row.original.actor] ?? row.original.actor }}</span>
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
          aria-label="Broj izmjena po stranici"
          class="w-40"
          @update:model-value="setSize"
        />
        <UPagination
          :page="state.page"
          :total="total"
          :items-per-page="state.size"
          @update:page="page => replaceQuery({ page: page > 1 ? String(page) : undefined })"
        />
      </div>
    </div>

    <AdminHistoryDrawer
      v-if="shown"
      :key="`${shown.kind}:${shown.id}`"
      v-model:open="drawerOpen"
      :kind="shown.kind"
      :entity-id="shown.id"
      @restored="log.refresh()"
    />
  </AdminPanel>
</template>
