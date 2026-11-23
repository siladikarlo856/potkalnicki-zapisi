<script setup lang="ts">
import type { InboxList, InboxRow } from '~~/shared/types/inbox'
import { CONTRIBUTION_KINDS, CONTRIBUTION_KIND_LABELS, isContributionKind } from '~~/shared/utils/contribution'
import { CONTENT_PAGE_SIZES } from '~~/shared/utils/content/common'
import { SUBMISSION_STATUSES, SUBMISSION_TYPES } from '~~/shared/utils/submission'
import type { SubmissionStatus, SubmissionType } from '~~/shared/utils/submission'
import { isMemoryDraftKind, MEMORY_DRAFT_KIND_LABELS } from '~~/shared/utils/memoryDraft'
import { INTENT_LABELS, SUBMISSION_STATUS_COLORS, SUBMISSION_STATUS_LABELS, SUBMISSION_TYPE_LABELS } from '~/utils/inbox'

const $fetch = useEditorialFetch()

// The unified inbox: word and memory contributions, corrections and proposals for new rows. Corrections are
// applied in the target's own edit dialog, proposals become drafts in it (both reuse the content dialogs).
// List state lives in the URL, so every view can be linked and survives a reload.
definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Zaprimljeno', robots: 'noindex, nofollow' })

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
  const query = Object.fromEntries(Object.entries({ ...route.query, ...(keepPage ? {} : { page: undefined, id: undefined }), ...patch })
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
const list = useFetch<InboxList>('/api/admin/inbox', { $fetch, query: apiQuery, server: false, key: 'admin-inbox' })
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

const selected = ref<number[]>([])
function toggle(id: number, value: boolean | 'indeterminate') {
  selected.value = value === true ? [...new Set([...selected.value, id])] : selected.value.filter(entry => entry !== id)
}

// The open contribution is kept in the URL (`?id=`) so a review can be linked; on a phone it replaces the list.
const openId = computed(() => {
  const id = Number(single(route.query.id))
  return Number.isSafeInteger(id) ? id : undefined
})
const openRow = computed(() => rows.value.find(row => row.id === openId.value) ?? (isWide.value ? rows.value[0] : undefined))
const isWide = useMedia('(min-width: 1024px)')
function open(row: InboxRow) {
  return setQuery({ id: row.id }, true)
}
function closeDetail() {
  return setQuery({ id: undefined }, true)
}

function formatDate(value: string) {
  return new Date(`${value.replace(' ', 'T')}Z`).toLocaleString('hr-HR')
}

/** The Story, Custom or Folk text a Memory became, for its row in the list. */
function memoryDraftLabel(row: InboxRow) {
  return row.created && isMemoryDraftKind(row.created.kind) ? MEMORY_DRAFT_KIND_LABELS[row.created.kind] : null
}

const bulkBusy = ref(false)
const bulkActions = [
  { key: 'reject', label: 'Odbij', icon: 'i-lucide-x' },
  { key: 'delete', label: 'Obriši', icon: 'i-lucide-trash-2' }
]
async function bulk(action: 'reject' | 'delete') {
  const count = selected.value.length
  if (!count || bulkBusy.value) return
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
const headline = computed(() => pending.value
  ? `${pending.value} ${nounFor(pending.value, ['prilog čeka', 'priloga čekaju', 'priloga čeka'])} pregled`
  : 'Nema priloga koji čekaju pregled')
</script>

<template>
  <AdminPanel
    title="Zaprimljeno"
    icon="i-lucide-inbox"
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
      <p
        class="text-sm text-muted"
        data-test="admin-inbox-headline"
      >
        {{ headline }}. Ispravak se primjenjuje u uređivaču zapisa kao nespremljena izmjena: spremanje ga odobrava. Prijedlog postaje skica, a objava skice ga odobrava.
      </p>

      <UTabs
        :model-value="state.status"
        :items="statusTabs"
        :content="false"
        @update:model-value="value => setQuery({ status: String(value) })"
      />

      <p
        v-if="bulkBusy"
        class="flex items-center gap-2 rounded-lg bg-inverted p-3 text-inverted"
        role="status"
        data-test="admin-inbox-bulk-busy"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-4 animate-spin"
        />
        Obrađujem {{ selected.length }} {{ nounFor(selected.length, ['prilog', 'priloga', 'priloga']) }}…
      </p>
      <AdminBulkActionBar
        v-else-if="selected.length"
        :count="selected.length"
        :actions="bulkActions"
        data-test="admin-inbox-bulk"
        @action="key => bulk(key as 'reject' | 'delete')"
        @clear="selected = []"
      />
      <div
        v-else
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

      <UAlert
        v-if="listError"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Priloge nismo uspjeli učitati"
        :description="`Ništa nije izgubljeno. ${listError.message}`"
        :actions="[{ label: 'Pokušaj ponovno', color: 'neutral', variant: 'outline', onClick: () => list.refresh() }]"
        role="alert"
      />

      <p
        v-else-if="loading && !rows.length"
        class="text-muted"
        role="status"
        data-test="admin-inbox-loading"
      >
        Učitavanje priloga…
      </p>

      <UEmpty
        v-else-if="!rows.length"
        icon="i-lucide-inbox"
        :title="state.status === 'pending' && !state.q && !state.type && !state.targetKind ? 'Sve je pregledano' : 'Nema prijedloga'"
        :description="state.status === 'pending' && !state.q && !state.type && !state.targetKind ? 'Nema priloga koji čekaju. Novi će se pojaviti ovdje i na oznaci u izborniku.' : 'Promijeni status ili filtre.'"
        data-test="admin-inbox-empty"
      />

      <div
        v-else
        class="grid items-start gap-4 lg:grid-cols-[minmax(20rem,25rem)_1fr]"
      >
        <ul
          class="flex flex-col divide-y divide-default rounded-lg ring ring-default"
          :class="openRow && !isWide ? 'hidden' : ''"
          aria-label="Prijedlozi"
          data-test="admin-inbox-table"
        >
          <li
            v-for="row in rows"
            :key="row.id"
            class="flex items-start gap-2 p-3"
            :class="openRow?.id === row.id ? 'bg-elevated' : ''"
          >
            <UCheckbox
              :model-value="selected.includes(row.id)"
              :aria-label="`Odaberi prilog ${row.id}`"
              class="mt-1"
              @update:model-value="value => toggle(row.id, value)"
            />
            <button
              type="button"
              class="flex min-w-0 flex-1 flex-col gap-1 text-left"
              :aria-label="`Detalji prijedloga ${row.id}`"
              :aria-current="openRow?.id === row.id ? 'true' : undefined"
              @click="open(row)"
            >
              <span class="truncate text-highlighted">{{ row.text }}</span>
              <span class="flex flex-wrap items-center gap-1 text-xs text-muted">
                <UBadge
                  v-if="row.type"
                  :label="SUBMISSION_TYPE_LABELS[row.type]"
                  :color="row.type === 'correction' || row.type === 'proposal' ? 'primary' : 'neutral'"
                  variant="subtle"
                  size="sm"
                />
                <UBadge
                  v-if="row.wordId && row.intent"
                  :label="INTENT_LABELS[row.intent]"
                  color="info"
                  variant="subtle"
                  size="sm"
                />
                <UBadge
                  :label="SUBMISSION_STATUS_LABELS[row.status]"
                  :color="SUBMISSION_STATUS_COLORS[row.status]"
                  variant="subtle"
                  size="sm"
                />
                <UBadge
                  v-if="memoryDraftLabel(row)"
                  :label="`Skica: ${memoryDraftLabel(row)}`"
                  color="info"
                  variant="outline"
                  size="sm"
                  data-test="admin-inbox-memory-draft-badge"
                />
                <UBadge
                  v-if="row.appliedAt"
                  label="Primijenjeno"
                  color="success"
                  variant="outline"
                  size="sm"
                />
              </span>
              <span class="text-xs text-muted">
                {{ row.name || 'anonimno' }}<template v-if="row.targetKind"> · {{ CONTRIBUTION_KIND_LABELS[row.targetKind] }}<template v-if="row.target?.label"> · {{ row.target.label }}</template><template v-if="row.target?.state === 'missing'"> (obrisano)</template></template>
                · {{ formatDate(row.createdAt) }}
              </span>
            </button>
          </li>
        </ul>

        <section
          v-if="openRow"
          class="flex flex-col gap-3 rounded-lg p-4 ring ring-default lg:sticky lg:top-4"
          aria-label="Pregled priloga"
        >
          <UButton
            v-if="!isWide"
            label="Natrag na popis"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="link"
            class="self-start px-0"
            @click="closeDetail"
          />
          <AdminInboxDetail
            :key="openRow.id"
            :row="openRow"
            @changed="refresh"
          />
        </section>
      </div>

      <div
        v-if="total > CONTENT_PAGE_SIZES[0]"
        class="flex justify-end"
      >
        <UPagination
          :page="state.page"
          :total="total"
          :items-per-page="CONTENT_PAGE_SIZES[0]"
          @update:page="page => setQuery({ page })"
        />
      </div>
    </div>
  </AdminPanel>
</template>
