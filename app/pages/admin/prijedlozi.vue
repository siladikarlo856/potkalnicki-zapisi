<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { InboxList, InboxRow } from '~~/shared/types/inbox'
import { CONTRIBUTION_KINDS, CONTRIBUTION_KIND_LABELS, isContributionKind } from '~~/shared/utils/contribution'
import { CONTENT_PAGE_SIZES } from '~~/shared/utils/content/common'
import { SUBMISSION_STATUSES, SUBMISSION_TYPES } from '~~/shared/utils/submission'
import type { SubmissionStatus, SubmissionType } from '~~/shared/utils/submission'
import { INTENT_LABELS, SUBMISSION_STATUS_COLORS, SUBMISSION_STATUS_LABELS, SUBMISSION_TYPE_LABELS } from '~/utils/inbox'

// The unified inbox: word and memory contributions, corrections and proposals for new rows. Corrections are
// applied in the target's own edit dialog, proposals become drafts in it (both reuse the content dialogs).
// List state lives in the URL, so every view can be linked and survives a reload.
definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Prijedlozi', robots: 'noindex, nofollow' })

const route = useRoute()
const router = useRouter()
const confirm = useAdminConfirm()
const toast = useToast()

function single(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

const state = computed(() => {
  const status = single(route.query.status)
  const type = single(route.query.type)
  const kind = single(route.query.targetKind)
  const page = Number(single(route.query.page))
  return {
    status: (SUBMISSION_STATUSES as readonly string[]).includes(status ?? '') ? status as SubmissionStatus : status === 'all' ? 'all' as const : 'pending' as const,
    type: (SUBMISSION_TYPES as readonly string[]).includes(type ?? '') ? type as SubmissionType : undefined,
    targetKind: isContributionKind(kind) ? kind : undefined,
    q: (single(route.query.q) ?? '').slice(0, 100),
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1
  }
})

function setQuery(patch: Record<string, string | number | undefined>, keepPage = false) {
  const query = Object.fromEntries(Object.entries({ ...route.query, ...patch, ...(keepPage ? {} : { page: undefined }) })
    .filter(([key, value]) => value !== undefined && value !== '' && !(key === 'status' && value === 'pending') && !(key === 'page' && value === 1)))
  return router.replace({ query })
}

const apiQuery = computed(() => ({
  status: state.value.status,
  type: state.value.type,
  targetKind: state.value.targetKind,
  q: state.value.q || undefined,
  page: state.value.page,
  size: CONTENT_PAGE_SIZES[0]
}))
const list = useFetch<InboxList>('/api/admin/inbox', { query: apiQuery, server: false, key: 'admin-inbox' })
const rows = computed(() => list.data.value?.rows ?? [])
const total = computed(() => list.data.value?.total ?? 0)
const loading = computed(() => list.status.value === 'pending' || list.status.value === 'idle')
const listError = computed(() => list.error.value ? adminApiError(list.error.value) : null)

async function refresh() {
  await Promise.all([list.refresh(), refreshNuxtData('admin-inbox-summary')])
  selected.value = []
}

// Search is typed freely and written to the URL after a pause.
const search = ref(state.value.q)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  if (value.trim() === state.value.q) return
  searchTimer = setTimeout(() => setQuery({ q: value.trim() }), 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const statusTabs = (['pending', 'approved', 'rejected', 'all'] as const).map(value => ({ label: SUBMISSION_STATUS_LABELS[value], value }))
const typeItems = [{ label: 'Sve vrste', value: '__all__' }, ...SUBMISSION_TYPES.map(value => ({ label: SUBMISSION_TYPE_LABELS[value], value }))]
const kindItems = [{ label: 'Sve vrste zapisa', value: '__all__' }, ...CONTRIBUTION_KINDS.map(value => ({ label: CONTRIBUTION_KIND_LABELS[value], value }))]

const expanded = ref<Record<string, boolean>>({})
const selected = ref<number[]>([])
const allSelected = computed(() => rows.value.length > 0 && selected.value.length === rows.value.length)
function toggleAll(value: boolean | 'indeterminate') {
  selected.value = value === true ? rows.value.map(row => row.id) : []
}
function toggle(id: number, value: boolean | 'indeterminate') {
  selected.value = value === true ? [...new Set([...selected.value, id])] : selected.value.filter(entry => entry !== id)
}

const columns: TableColumn<InboxRow>[] = [
  { id: 'select', header: () => '', meta: { class: { th: 'w-10', td: 'w-10' } } },
  { id: 'info', meta: { class: { th: 'w-12', td: 'w-12' } } },
  { id: 'text', header: 'Prijedlog' },
  { id: 'target', header: 'Odnosi se na', meta: { class: { th: 'hidden md:table-cell', td: 'hidden md:table-cell' } } },
  { id: 'status', header: 'Status' },
  { id: 'createdAt', header: 'Poslano', meta: { class: { th: 'hidden lg:table-cell', td: 'hidden lg:table-cell' } } }
]

function formatDate(value: string) {
  return new Date(`${value.replace(' ', 'T')}Z`).toLocaleString('hr-HR')
}

const bulkBusy = ref(false)
async function bulk(action: 'reject' | 'delete') {
  const count = selected.value.length
  if (!count) return
  if (!await confirm({
    title: action === 'delete' ? `Obrisati ${count} prijedloga?` : `Odbiti ${count} prijedloga?`,
    description: action === 'delete'
      ? 'Prijedlozi se trajno brišu zajedno s imenima i kontaktima. Zahvale i zapisi nastali iz njih se povlače.'
      : 'Prijedlozi se označavaju kao odbijeni. Primijenjeni se preskaču.',
    confirmLabel: action === 'delete' ? 'Obriši' : 'Odbij',
    color: action === 'delete' ? 'error' : 'primary'
  })) return
  bulkBusy.value = true
  try {
    const result = await $fetch<{ done: number, skipped: number }>('/api/admin/inbox/bulk', { method: 'POST', body: { ids: selected.value, action } })
    toast.add({
      title: action === 'delete' ? `Obrisano: ${result.done}` : `Odbijeno: ${result.done}`,
      description: result.skipped ? `Preskočeno: ${result.skipped}` : undefined, color: 'success', icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({ title: 'Radnja nije uspjela', description: adminApiError(error).message, color: 'error' })
  } finally {
    bulkBusy.value = false
    await refresh()
  }
}

const pending = computed(() => list.data.value?.counts.pending ?? 0)
</script>

<template>
  <AdminPanel
    title="Prijedlozi"
    icon="i-lucide-inbox"
    width="wide"
  >
    <template #actions>
      <UButton
        label="Osvježi"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="subtle"
        :loading="loading"
        @click="refresh"
      />
    </template>

    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Ispravci i prijedlozi novih zapisa, uz riječi i sjećanja iz obrasca. <strong v-if="pending">Na čekanju: {{ pending }}.</strong>
        Ispravak se primjenjuje u uređivaču zapisa: spremanje ga odobrava. Prijedlog postaje skica, a objava skice ga odobrava.
      </p>

      <UTabs
        :model-value="state.status"
        :items="statusTabs"
        :content="false"
        @update:model-value="value => setQuery({ status: String(value) })"
      />

      <div
        class="flex flex-wrap items-center gap-2"
        role="search"
      >
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Pretraži tekst ili ime"
          aria-label="Pretraži prijedloge"
          class="w-full sm:w-72"
          data-test="admin-inbox-search"
        />
        <USelect
          :model-value="state.type ?? '__all__'"
          :items="typeItems"
          aria-label="Vrsta prijedloga"
          class="min-w-44"
          @update:model-value="value => setQuery({ type: value === '__all__' ? undefined : String(value) })"
        />
        <USelect
          :model-value="state.targetKind ?? '__all__'"
          :items="kindItems"
          aria-label="Vrsta zapisa"
          class="min-w-44"
          @update:model-value="value => setQuery({ targetKind: value === '__all__' ? undefined : String(value) })"
        />
        <span class="ms-auto text-sm text-muted">{{ total }} {{ total % 10 === 1 && total % 100 !== 11 ? 'prijedlog' : 'prijedloga' }}</span>
      </div>

      <div
        v-if="selected.length"
        class="flex flex-wrap items-center gap-2 rounded-lg bg-elevated p-2"
        data-test="admin-inbox-bulk"
      >
        <span class="text-sm">Odabrano: {{ selected.length }}</span>
        <UButton
          label="Odbij odabrane"
          icon="i-lucide-x"
          color="neutral"
          variant="subtle"
          size="sm"
          :loading="bulkBusy"
          @click="bulk('reject')"
        />
        <UButton
          label="Obriši odabrane"
          icon="i-lucide-trash-2"
          color="error"
          variant="subtle"
          size="sm"
          :loading="bulkBusy"
          @click="bulk('delete')"
        />
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
        icon="i-lucide-inbox"
        title="Nema prijedloga"
        description="Promijeni status ili filtre."
        data-test="admin-inbox-empty"
      />

      <UTable
        v-else
        v-model:expanded="expanded"
        :data="rows"
        :columns="columns"
        :loading="loading"
        :get-row-id="row => String(row.id)"
        caption="Prijedlozi"
        class="rounded-lg ring ring-default"
        data-test="admin-inbox-table"
        @select="(_event, row) => row.toggleExpanded()"
      >
        <template #select-header>
          <UCheckbox
            :model-value="allSelected"
            aria-label="Odaberi sve prijedloge na stranici"
            @click.stop
            @update:model-value="toggleAll"
          />
        </template>
        <template #select-cell="{ row }">
          <UCheckbox
            :model-value="selected.includes(row.original.id)"
            :aria-label="`Odaberi prijedlog ${row.original.id}`"
            @click.stop
            @update:model-value="value => toggle(row.original.id, value)"
          />
        </template>
        <template #info-cell="{ row }">
          <UButton
            icon="i-lucide-info"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="`Detalji prijedloga ${row.original.id}`"
            :aria-expanded="row.getIsExpanded()"
            @click.stop="row.toggleExpanded()"
          />
        </template>
        <template #text-cell="{ row }">
          <span class="block max-w-[10rem] truncate text-highlighted sm:max-w-md">{{ row.original.text }}</span>
          <div class="mt-1 flex flex-wrap gap-1">
            <UBadge
              v-if="row.original.type"
              :label="SUBMISSION_TYPE_LABELS[row.original.type]"
              :color="row.original.type === 'correction' || row.original.type === 'proposal' ? 'primary' : 'neutral'"
              variant="subtle"
              size="sm"
            />
            <UBadge
              v-if="row.original.wordId && row.original.intent"
              :label="INTENT_LABELS[row.original.intent]"
              color="info"
              variant="subtle"
              size="sm"
            />
          </div>
        </template>
        <template #target-cell="{ row }">
          <span
            v-if="row.original.targetKind"
            class="text-sm"
          >
            {{ CONTRIBUTION_KIND_LABELS[row.original.targetKind] }}<template v-if="row.original.target?.label"> · {{ row.original.target.label }}</template>
            <span
              v-if="row.original.target?.state === 'missing'"
              class="text-dimmed"
            > (obrisano)</span>
          </span>
          <span
            v-else
            class="text-dimmed"
          >—</span>
        </template>
        <template #status-cell="{ row }">
          <div class="flex flex-wrap gap-1">
            <UBadge
              :label="SUBMISSION_STATUS_LABELS[row.original.status]"
              :color="SUBMISSION_STATUS_COLORS[row.original.status]"
              variant="subtle"
            />
            <UBadge
              v-if="row.original.appliedAt"
              label="Primijenjeno"
              color="success"
              variant="outline"
            />
          </div>
        </template>
        <template #createdAt-cell="{ row }">
          <span class="text-sm text-dimmed">{{ formatDate(row.original.createdAt) }}</span>
        </template>
        <template #expanded="{ row }">
          <AdminInboxDetail
            :row="row.original"
            @changed="refresh"
          />
        </template>
      </UTable>

      <div
        v-if="total > CONTENT_PAGE_SIZES[0]"
        class="flex justify-end"
      >
        <UPagination
          :page="state.page"
          :total="total"
          :items-per-page="CONTENT_PAGE_SIZES[0]"
          @update:page="page => setQuery({ page }, true)"
        />
      </div>
    </div>
  </AdminPanel>
</template>
