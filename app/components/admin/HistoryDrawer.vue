<script setup lang="ts">
import type { ContentKind } from '~~/shared/utils/content/common'
import type { HistoryAction, HistoryRevision, HistoryRevisions } from '~~/shared/utils/content/history'
import { HISTORY_ACTION_LABELS, HISTORY_ACTOR_LABELS, HISTORY_KIND_META } from '~~/shared/utils/content/history'

// The change history of one row in a slide-over: every write the database recorded, newest first,
// with the fields it changed and a button that writes that version back as a new revision.
// Also works for a deleted row (opened from /admin/povijest), where a restore recreates it.
const props = defineProps<{
  kind: ContentKind
  entityId: string
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ restored: [] }>()

const api = useAdminContentApi(props.kind)
const confirm = useAdminConfirm()
const toast = useToast()

const history = ref<HistoryRevisions | null>(null)
const revisions = ref<HistoryRevision[]>([])
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const failure = ref('')
const restoring = ref<number | null>(null)

const meta = computed(() => HISTORY_KIND_META[props.kind])
const description = computed(() => {
  if (!history.value) return meta.value.singular
  return history.value.exists ? `${meta.value.singular} · revizija ${history.value.currentRevision}` : `${meta.value.singular} · obrisano`
})

async function load() {
  loading.value = true
  failure.value = ''
  try {
    const result = await api.revisions(props.entityId)
    history.value = result
    revisions.value = result.revisions
    hasMore.value = result.hasMore
  } catch (error) {
    history.value = null
    revisions.value = []
    hasMore.value = false
    failure.value = adminApiError(error).message
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  const last = revisions.value.at(-1)
  if (!last || loadingMore.value) return
  loadingMore.value = true
  try {
    const result = await api.revisions(props.entityId, { before: last.id })
    revisions.value = [...revisions.value, ...result.revisions]
    hasMore.value = result.hasMore
  } catch (error) {
    toast.add({ title: 'Starije izmjene nisu učitane', description: adminApiError(error).message, color: 'error' })
  } finally {
    loadingMore.value = false
  }
}

watch(() => [open.value, props.entityId] as const, ([isOpen]) => {
  if (isOpen) load()
}, { immediate: true })

/** The newest revision of a row that exists is its current version. */
function isCurrent(revision: HistoryRevision) {
  return !!history.value?.exists && revision.id === revisions.value[0]?.id && revision.action !== 'delete'
}

const ACTION_COLORS: Record<HistoryAction, 'success' | 'info' | 'error'> = { insert: 'success', update: 'info', delete: 'error' }

function formatDate(value: string) {
  return new Date(value).toLocaleString('hr-HR', { dateStyle: 'medium', timeStyle: 'short' })
}

async function restore(revision: HistoryRevision) {
  if (!history.value) return
  const exists = history.value.exists
  if (!await confirm({
    title: exists ? `Vratiti verziju ${revision.revision}?` : `Vratiti obrisani zapis?`,
    description: exists
      ? 'Zapis dobiva vrijednosti iz te verzije kao novu reviziju. Povijest ostaje sačuvana, pa i ovo možeš poništiti.'
      : 'Zapis će se ponovno stvoriti s vrijednostima iz te verzije, pod istim identifikatorom.',
    confirmLabel: 'Vrati',
    color: 'warning',
    icon: 'i-lucide-history'
  })) return
  restoring.value = revision.id
  try {
    const result = await api.restore(props.entityId, { revisionId: revision.id, revision: history.value.currentRevision ?? undefined })
    toast.add(result.unchanged
      ? { title: 'Zapis je već u toj verziji', description: history.value.label, color: 'neutral', icon: 'i-lucide-info' }
      : { title: result.recreated ? 'Zapis je vraćen' : 'Verzija je vraćena', description: history.value.label, color: 'success', icon: 'i-lucide-history' })
    emit('restored')
  } catch (error) {
    const problem = adminApiError(error)
    toast.add({
      title: problem.code === 'revision-conflict' ? 'Zapis je u međuvremenu izmijenjen' : 'Vraćanje nije uspjelo',
      description: problem.code === 'revision-conflict' ? 'Povijest je ponovno učitana; provjeri je i pokušaj opet.' : problem.message,
      color: problem.code === 'revision-conflict' ? 'warning' : 'error'
    })
  } finally {
    restoring.value = null
  }
  await load()
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="history ? `Povijest: ${history.label}` : 'Povijest'"
    :description="description"
    :ui="{ content: 'sm:max-w-lg' }"
    data-test="admin-history"
  >
    <template #body>
      <div
        v-if="loading"
        class="flex flex-col gap-4"
        aria-busy="true"
      >
        <USkeleton class="h-6 w-1/2" />
        <USkeleton class="h-16 w-full" />
        <USkeleton class="h-6 w-1/3" />
        <USkeleton class="h-16 w-full" />
      </div>

      <UAlert
        v-else-if="failure"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="failure"
        :actions="[{ label: 'Pokušaj ponovno', color: 'neutral', variant: 'outline', onClick: load }]"
        role="alert"
      />

      <UEmpty
        v-else-if="!revisions.length"
        icon="i-lucide-history"
        title="Nema zabilježenih izmjena"
      />

      <ol
        v-else
        class="flex flex-col gap-4"
        aria-label="Izmjene zapisa, od najnovije"
        data-test="history-list"
      >
        <li
          v-for="revision in revisions"
          :key="revision.id"
          class="flex flex-col gap-3 rounded-lg border border-default p-3"
          :data-test="`history-revision-${revision.revision}`"
        >
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              :label="HISTORY_ACTION_LABELS[revision.action]"
              :color="ACTION_COLORS[revision.action]"
              variant="subtle"
            />
            <span class="text-sm font-medium text-highlighted">Revizija {{ revision.revision }}</span>
            <UBadge
              v-if="isCurrent(revision)"
              label="Trenutna verzija"
              color="neutral"
              variant="outline"
            />
            <time
              :datetime="revision.createdAt"
              class="ms-auto text-xs text-muted"
            >
              {{ formatDate(revision.createdAt) }}
            </time>
          </div>
          <p class="text-xs text-muted">
            {{ HISTORY_ACTOR_LABELS[revision.actor] ?? revision.actor }}<template v-if="revision.submissionId">
              · iz priloga #{{ revision.submissionId }}
            </template>
          </p>

          <AdminHistoryChanges
            :kind="kind"
            :action="revision.action"
            :changes="revision.changes"
          />

          <UButton
            v-if="!isCurrent(revision)"
            :label="history?.exists ? 'Vrati ovu verziju' : 'Vrati zapis u ovoj verziji'"
            icon="i-lucide-history"
            color="neutral"
            variant="outline"
            size="sm"
            class="self-start"
            :loading="restoring === revision.id"
            :disabled="restoring !== null"
            data-test="history-restore"
            @click="restore(revision)"
          />
        </li>
      </ol>

      <UButton
        v-if="hasMore && !loading"
        label="Učitaj starije"
        color="neutral"
        variant="ghost"
        block
        class="mt-4"
        :loading="loadingMore"
        data-test="history-more"
        @click="loadMore"
      />
    </template>

    <template #footer>
      <UButton
        v-if="history?.exists"
        label="Uredi zapis"
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        :to="{ path: meta.adminPath, query: { uredi: entityId } }"
      />
      <UButton
        label="Zatvori"
        color="neutral"
        variant="subtle"
        class="ms-auto"
        @click="open = false"
      />
    </template>
  </USlideover>
</template>
