<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { heritageItemById, settlementByCode } from '~~/shared/utils/atlasData'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })

const { t, locale } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('review.bastina.title'),
  robots: 'noindex, nofollow'
})

type Filter = SubmissionStatus | 'all'

const filter = ref<Filter>('pending')
const submissions = ref<Submission[]>([])
const loading = ref(false)
const busyId = ref<number>()
const error = ref('')

const expanded = ref<Record<string, boolean>>({})
const columns = computed<TableColumn<Submission>[]>(() => [
  { id: 'info', meta: { class: { th: 'w-12', td: 'w-12' } } },
  { id: 'target', header: t('review.bastina.fields.target') },
  { id: 'text', header: t('review.fields.text') },
  { id: 'status', header: t('review.fields.status') },
  { id: 'createdAt', header: t('review.fields.sent'), meta: { class: { th: 'hidden md:table-cell', td: 'hidden md:table-cell' } } }
])

const filters = computed(() => (['pending', 'approved', 'rejected', 'all'] as const)
  .map(value => ({ label: t(`review.statuses.${value}`), value })))

function errorMessage(err: unknown, fallback: string) {
  const statusCode = (err as { statusCode?: number }).statusCode
  if (statusCode === 401) {
    navigateTo('/admin/prijava')
    return t('review.wrongPassword')
  }
  if (statusCode === 503) return t('review.notConfigured')
  if (statusCode === 429) return t('review.tooMany')
  return fallback
}

function api<T>(path: string, options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: Record<string, unknown>, query?: Record<string, string> } = {}) {
  return $fetch<T>(path, options)
}

function targetMeta(ref: string | null) {
  if (!ref) return { label: '—', to: undefined as string | undefined }
  const item = heritageItemById(ref)
  if (!item) return { label: t('review.bastina.unknownTarget', { id: ref }), to: undefined }
  const settlement = item.settlementCode ? settlementByCode(item.settlementCode) : undefined
  const label = settlement ? `${item.name} · ${settlement.name}` : item.name
  const to = settlement
    ? localePath(`/potkalnicko-prigorje/bastina/${settlement.slug}/${item.slug}`)
    : undefined
  return { label, to }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    submissions.value = await api<Submission[]>('/api/review/submissions', {
      query: { status: filter.value, type: 'correction' }
    })
  } catch (err) {
    submissions.value = []
    error.value = errorMessage(err, t('review.loadError'))
  } finally {
    loading.value = false
  }
}

async function act(submission: Submission, action: SubmissionStatus | 'delete') {
  if (action === 'delete' && !window.confirm(t('review.confirmDelete'))) return
  if (action === 'rejected' && !window.confirm(t('review.confirmReject'))) return
  busyId.value = submission.id
  error.value = ''
  try {
    if (action === 'delete') {
      await api(`/api/review/submissions/${submission.id}`, { method: 'DELETE' })
    } else {
      await api(`/api/review/submissions/${submission.id}`, { method: 'PATCH', body: { status: action } })
    }
    await load()
  } catch (err) {
    error.value = errorMessage(err, t('review.actionError'))
  } finally {
    busyId.value = undefined
  }
}

function formatDate(value: string) {
  return new Date(`${value.replace(' ', 'T')}Z`).toLocaleString(locale.value === 'hr' ? 'hr-HR' : 'en-GB')
}

const statusColor = { pending: 'warning', approved: 'success', rejected: 'neutral' } as const

watch(filter, load)

onMounted(load)
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <div class="mx-auto flex max-w-5xl flex-col gap-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-3xl font-bold tracking-tight text-highlighted">
            {{ t('review.bastina.title') }}
          </h1>
          <p class="mt-2 text-sm text-muted">
            {{ t('review.bastina.intro') }}
          </p>
        </div>
        <UButton
          :label="t('review.refresh')"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="subtle"
          :loading="loading"
          @click="load"
        />
      </div>

      <UAlert
        v-if="error"
        :title="error"
        icon="i-lucide-circle-alert"
        color="error"
        variant="subtle"
        role="alert"
      />

      <UTabs
        v-model="filter"
        :items="filters"
        :content="false"
      />

      <p
        v-if="!loading && !submissions.length && !error"
        class="text-muted"
      >
        {{ t('review.empty') }}
      </p>

      <UTable
        v-model:expanded="expanded"
        :data="submissions"
        :columns="columns"
        :loading="loading"
        :get-row-id="row => String(row.id)"
        :caption="t('review.bastina.tableCaption')"
        class="rounded-lg ring ring-default"
        data-testid="admin-bastina-table"
        @select="(_event, row) => row.toggleExpanded()"
      >
        <template #info-cell="{ row }">
          <UButton
            icon="i-lucide-info"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="t('review.details', { id: row.original.id })"
            :aria-expanded="row.getIsExpanded()"
            @click="row.toggleExpanded()"
          />
        </template>
        <template #target-cell="{ row }">
          <ULink
            v-if="targetMeta(row.original.targetRef).to"
            :to="targetMeta(row.original.targetRef).to!"
            class="block max-w-[10rem] truncate text-primary sm:max-w-md"
            data-testid="admin-bastina-target-link"
          >
            {{ targetMeta(row.original.targetRef).label }}
          </ULink>
          <span
            v-else
            class="block max-w-[10rem] truncate text-highlighted sm:max-w-md"
            data-testid="admin-bastina-target-label"
          >
            {{ targetMeta(row.original.targetRef).label }}
          </span>
        </template>
        <template #text-cell="{ row }">
          <span class="block max-w-[10rem] truncate text-dimmed sm:max-w-md">{{ row.original.text }}</span>
        </template>
        <template #status-cell="{ row }">
          <UBadge
            :label="t(`review.statuses.${row.original.status}`)"
            :color="statusColor[row.original.status]"
            variant="subtle"
          />
        </template>
        <template #createdAt-cell="{ row }">
          <span class="text-sm text-dimmed">{{ formatDate(row.original.createdAt) }}</span>
        </template>
        <template #expanded="{ row: { original: submission } }">
          <div class="flex flex-col gap-4">
            <p class="text-sm text-dimmed">
              #{{ submission.id }} · {{ formatDate(submission.createdAt) }}
            </p>

            <dl class="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt class="text-muted">
                {{ t('review.bastina.fields.target') }}
              </dt>
              <dd>
                <ULink
                  v-if="targetMeta(submission.targetRef).to"
                  :to="targetMeta(submission.targetRef).to!"
                  class="text-primary"
                >
                  {{ targetMeta(submission.targetRef).label }}
                </ULink>
                <span v-else>{{ targetMeta(submission.targetRef).label }}</span>
                <span
                  v-if="submission.targetRef"
                  class="block text-xs text-muted"
                >{{ submission.targetRef }}</span>
              </dd>
            </dl>

            <p class="whitespace-pre-line text-highlighted">
              {{ submission.text }}
            </p>

            <dl class="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt class="text-muted">
                {{ t('review.fields.name') }}
              </dt>
              <dd>{{ submission.name || t('review.anonymous') }}</dd>
              <dt class="text-muted">
                {{ t('review.fields.contact') }}
              </dt>
              <dd class="break-all">
                {{ submission.contact || '—' }}
              </dd>
              <dt class="text-muted">
                {{ t('review.fields.consent') }}
              </dt>
              <dd>{{ submission.consentPublish ? t('review.consentGiven', { version: submission.consentVersion }) : '—' }}</dd>
            </dl>

            <div class="flex flex-wrap gap-2">
              <UButton
                v-if="submission.status !== 'approved'"
                :label="t('review.approve')"
                icon="i-lucide-check"
                color="success"
                variant="subtle"
                :disabled="busyId !== undefined"
                @click="act(submission, 'approved')"
              />
              <UButton
                v-if="submission.status !== 'rejected'"
                :label="t('review.reject')"
                icon="i-lucide-x"
                color="neutral"
                variant="subtle"
                :disabled="busyId !== undefined"
                @click="act(submission, 'rejected')"
              />
              <UButton
                v-if="submission.status !== 'pending'"
                :label="t('review.toPending')"
                icon="i-lucide-undo-2"
                color="neutral"
                variant="ghost"
                :disabled="busyId !== undefined"
                @click="act(submission, 'pending')"
              />
              <UButton
                :label="t('review.delete')"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                class="sm:ml-auto"
                :disabled="busyId !== undefined"
                @click="act(submission, 'delete')"
              />
            </div>
          </div>
        </template>
      </UTable>
    </div>
  </UContainer>
</template>
