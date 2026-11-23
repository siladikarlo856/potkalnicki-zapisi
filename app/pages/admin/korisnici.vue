<script setup lang="ts">
import type { AccountAdminList, AccountAuditRow, AccountPendingRow, AccountRow } from '~~/shared/types/accounts'
import { ACCOUNT_AUDIT_ACTION_LABELS, ACCOUNT_PENDING_STATUS_LABELS, ACCOUNT_ROLE_LABELS } from '~/utils/accountLabels'

definePageMeta({ layout: 'admin', middleware: ['admin', 'admin-users'] })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Korisnici', robots: 'noindex, nofollow' })

const $fetch = useEditorialFetch()
const confirm = useAdminConfirm()
const toast = useToast()
const route = useRoute()
const router = useRouter()

function single(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

const state = computed(() => {
  const page = Number(single(route.query.page))
  const pendingPage = Number(single(route.query.pendingPage))
  return {
    q: (single(route.query.q) ?? '').slice(0, 100),
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
    pendingPage: Number.isSafeInteger(pendingPage) && pendingPage >= 1 ? pendingPage : 1
  }
})

function setQuery(patch: Record<string, string | number | undefined>) {
  const query = Object.fromEntries(Object.entries({ ...route.query, ...patch })
    .filter(([key, value]) => value !== undefined && value !== '' && !(['page', 'pendingPage'].includes(key) && value === 1)))
  return router.replace({ query })
}

const apiQuery = computed(() => ({ q: state.value.q || undefined, page: state.value.page, pendingPage: state.value.pendingPage }))
const list = useFetch<AccountAdminList>('/api/admin/accounts', { $fetch, query: apiQuery, server: false, key: 'admin-accounts' })
const audit = useFetch<{ rows: import('~~/shared/types/accounts').AccountAuditRow[] }>('/api/admin/accounts/audit', {
  $fetch, server: false, key: 'admin-accounts-audit'
})

const loading = computed(() => list.status.value === 'pending' || list.status.value === 'idle')
const listError = computed(() => list.error.value ? adminApiError(list.error.value) : null)
const accounts = computed((): AccountRow[] => list.data.value?.accounts ?? [])
const pendingRows = computed((): AccountPendingRow[] => list.data.value?.pending ?? [])
const accountsTotal = computed(() => list.data.value?.accountsTotal ?? 0)
const pendingTotal = computed(() => list.data.value?.pendingTotal ?? 0)
const pageSize = computed(() => list.data.value?.size ?? 25)
const auditRows = computed((): AccountAuditRow[] => audit.data.value?.rows ?? [])

watch(list.data, (data) => {
  if (!data || data.page !== state.value.page || data.pendingPage !== state.value.pendingPage) return
  const page = Math.min(data.page, Math.max(1, Math.ceil(data.accountsTotal / data.size)))
  const pendingPage = Math.min(data.pendingPage, Math.max(1, Math.ceil(data.pendingTotal / data.size)))
  if (page !== data.page || pendingPage !== data.pendingPage) setQuery({ page, pendingPage })
})

const search = ref(state.value.q)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  if (value.trim() === state.value.q) return
  searchTimer = setTimeout(() => setQuery({ q: value.trim(), page: undefined, pendingPage: undefined }), 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const preEmail = ref('')
const preBusy = ref(false)

async function refresh() {
  await Promise.all([list.refresh(), audit.refresh()])
}

async function preauthorize() {
  const email = preEmail.value.trim()
  if (!email) return
  preBusy.value = true
  try {
    await $fetch('/api/admin/accounts/pending', { method: 'POST', body: { email } })
    preEmail.value = ''
    toast.add({ title: 'E-pošta dodana na listu čekanja', color: 'success' })
    await refresh()
  } catch (error) {
    toast.add({ title: 'Dodavanje nije uspjelo', description: adminApiError(error).message, color: 'error' })
  } finally {
    preBusy.value = false
  }
}

async function cancelPending(id: string) {
  try {
    await $fetch(`/api/admin/accounts/pending/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Autorizacija otkazana', color: 'success' })
    await refresh()
  } catch (error) {
    toast.add({ title: 'Otkazivanje nije uspjelo', description: adminApiError(error).message, color: 'error' })
  }
}

async function promote(id: string) {
  try {
    await $fetch(`/api/admin/accounts/${id}/promote`, { method: 'POST' })
    toast.add({ title: 'Održavatelj dodijeljen', color: 'success' })
    await refresh()
  } catch (error) {
    toast.add({ title: 'Dodjela nije uspjela', description: adminApiError(error).message, color: 'error' })
  }
}

async function revoke(id: string, email: string | null) {
  const ok = await confirm({
    title: 'Opozvati ulogu održavatelja?',
    description: email ? `Račun ${email} izgubit će pristup uređivanju pri sljedećem zahtjevu.` : 'Račun izgubit će pristup uređivanju pri sljedećem zahtjevu.',
    confirmLabel: 'Opozovi',
    color: 'error'
  })
  if (!ok) return
  try {
    await $fetch(`/api/admin/accounts/${id}/revoke`, { method: 'POST' })
    toast.add({ title: 'Uloga opozvana', color: 'success' })
    await refresh()
  } catch (error) {
    toast.add({ title: 'Opoziv nije uspio', description: adminApiError(error).message, color: 'error' })
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('hr-HR', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <AdminPanel
    title="Korisnici"
    description="Dodaj održavatelje prethodnom autorizacijom e-pošte ili promocijom registriranog računa. Promjene se bilježe u reviziji."
    icon="i-lucide-users"
  >
    <UAlert
      v-if="listError"
      color="error"
      :title="listError.message"
      class="mb-2"
    />

    <section class="flex flex-col gap-3 rounded-lg border border-default p-4">
      <h2 class="font-display text-lg font-bold">
        Prethodna autorizacija
      </h2>
      <p class="text-sm text-muted">
        Osoba će dobiti ulogu održavatelja kad se prvi put prijavi s Google računom na toj adresi.
      </p>
      <form
        class="flex flex-col gap-2 sm:flex-row sm:items-end"
        @submit.prevent="preauthorize"
      >
        <UFormField
          label="E-pošta"
          class="min-w-0 flex-1"
        >
          <UInput
            v-model="preEmail"
            type="email"
            autocomplete="off"
            placeholder="urednik@example.com"
            data-testid="account-preauth-email"
          />
        </UFormField>
        <UButton
          type="submit"
          :loading="preBusy"
          :disabled="!preEmail.trim()"
          data-testid="account-preauth-submit"
        >
          Dodaj na čekanje
        </UButton>
      </form>
    </section>

    <section class="flex flex-col gap-3">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Traži račune i e-poštu na čekanju"
        class="max-w-md"
        data-testid="account-search"
      />
      <div
        v-if="loading"
        class="text-muted"
      >
        Učitavanje…
      </div>
      <template v-else>
        <UTable
          :data="accounts"
          :columns="[
            { accessorKey: 'email', header: 'E-pošta' },
            { accessorKey: 'role', header: 'Uloga' },
            { id: 'actions', header: '' }
          ]"
          data-testid="account-table"
        >
          <template #email-cell="{ row }">
            <span class="font-mono text-sm">{{ row.original.email ?? '—' }}</span>
          </template>
          <template #role-cell="{ row }">
            {{ ACCOUNT_ROLE_LABELS[row.original.role] }}
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton
                v-if="row.original.role === 'none'"
                size="sm"
                variant="soft"
                :data-testid="`account-promote-${row.original.id}`"
                @click="promote(row.original.id)"
              >
                Postavi održavateljem
              </UButton>
              <UButton
                v-if="row.original.role === 'maintainer'"
                size="sm"
                color="error"
                variant="soft"
                :data-testid="`account-revoke-${row.original.id}`"
                @click="revoke(row.original.id, row.original.email)"
              >
                Opozovi
              </UButton>
            </div>
          </template>
        </UTable>
        <div
          v-if="accountsTotal > pageSize"
          class="flex justify-end"
        >
          <UPagination
            data-testid="account-pagination"
            :page="state.page"
            :total="accountsTotal"
            :items-per-page="pageSize"
            @update:page="page => setQuery({ page })"
          />
        </div>
      </template>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="font-display text-lg font-bold">
        Lista čekanja
      </h2>
      <UTable
        :data="pendingRows"
        :columns="[
          { accessorKey: 'email', header: 'E-pošta' },
          { accessorKey: 'status', header: 'Stanje' },
          { id: 'actions', header: '' }
        ]"
        data-testid="account-pending-table"
      >
        <template #status-cell="{ row }">
          {{ ACCOUNT_PENDING_STATUS_LABELS[row.original.status] }}
        </template>
        <template #actions-cell="{ row }">
          <UButton
            v-if="row.original.status === 'pending'"
            size="sm"
            color="neutral"
            variant="ghost"
            :data-testid="`account-cancel-${row.original.id}`"
            @click="cancelPending(row.original.id)"
          >
            Otkaži
          </UButton>
        </template>
      </UTable>
      <div
        v-if="pendingTotal > pageSize"
        class="flex justify-end"
      >
        <UPagination
          :page="state.pendingPage"
          :total="pendingTotal"
          :items-per-page="pageSize"
          data-testid="account-pending-pagination"
          @update:page="pendingPage => setQuery({ pendingPage })"
        />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="font-display text-lg font-bold">
        Revizija uloga
      </h2>
      <UTable
        :data="auditRows"
        :columns="[
          { accessorKey: 'createdAt', header: 'Vrijeme' },
          { accessorKey: 'action', header: 'Radnja' },
          { accessorKey: 'targetEmail', header: 'E-pošta / račun' }
        ]"
        data-testid="account-audit-table"
      >
        <template #createdAt-cell="{ row }">
          {{ formatTime(row.original.createdAt) }}
        </template>
        <template #action-cell="{ row }">
          {{ ACCOUNT_AUDIT_ACTION_LABELS[row.original.action] }}
        </template>
        <template #targetEmail-cell="{ row }">
          <span class="font-mono text-sm">{{ row.original.targetEmail ?? row.original.targetAccountId ?? '—' }}</span>
        </template>
      </UTable>
    </section>
  </AdminPanel>
</template>
