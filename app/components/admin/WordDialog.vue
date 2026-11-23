<script setup lang="ts">
import type { InboxDetail } from '~~/shared/types/inbox'
import type { ContentStatus } from '~~/shared/utils/content/common'
import { wordStatusToActive } from '~~/shared/utils/content/word'
import type { Word, WordValue } from '~~/shared/utils/content/word'
import { validateWord } from '~~/shared/utils/word'
import type { WordInput } from '~~/shared/utils/word'
import type { AdminResource } from '~/composables/useAdminResource'

const $fetch = useEditorialFetch()

const props = defineProps<{
  resource: AdminResource<Word, WordValue>
  entityId?: string
  prefill?: Partial<WordValue>
  /** A word correction from the inbox (`?prijedlog=<id>`): its changes are put into the entry and applied on save. */
  proposalId?: number
  visible: boolean
}>()
const emit = defineEmits<{ saved: [entity: Word], closed: [] }>()

const api = useAdminContentApi<Word>('word')
const toast = useToast()
const confirm = useAdminConfirm()

const editorVersion = ref(0)
const model = ref<WordInput>()
const entity = ref<Word | null>(null)
const loading = ref(false)
const saving = ref(false)
const failure = ref('')
const conflict = ref<Word | null>(null)
const proposal = ref<InboxDetail | null>(null)
const proposalCredit = ref(true)

const isEdit = computed(() => !!props.entityId)
const title = computed(() => isEdit.value ? props.resource.labels.edit : props.resource.labels.create)
const dirty = computed(() => !!model.value)

function toInput(word: WordValue): WordInput {
  return {
    entry: word.entry,
    areas: word.areas,
    active: wordStatusToActive(word.status)
  }
}

function blankWord(prefill?: Partial<WordValue>): WordInput {
  const id = crypto.randomUUID()
  return validateWord({
    active: false,
    areas: prefill?.areas ?? [],
    entry: {
      ...(prefill?.entry ?? {}),
      headword: prefill?.entry?.headword ?? '',
      meaning: prefill?.entry?.meaning ?? { hr: '' },
      status: prefill?.entry?.status ?? 'community',
      sources: prefill?.entry?.sources ?? [],
      variants: prefill?.entry?.variants ?? [{ id: crypto.randomUUID(), form: '', status: 'community', usages: [] }],
      id
    }
  }, id).value
}

function resetFromEntity(word: Word | null, prefill?: Partial<WordValue>) {
  editorVersion.value++
  model.value = word ? toInput(word) : blankWord(prefill)
}

async function loadProposal() {
  proposal.value = null
  proposalCredit.value = true
  if (!props.proposalId) return
  try {
    const detail = await $fetch<InboxDetail>(`/api/admin/inbox/${props.proposalId}`)
    proposal.value = detail
    const entry = detail.patch?.entry as WordInput['entry'] | undefined
    if (entry && model.value && detail.submission.targetId === props.entityId && !detail.submission.appliedAt) {
      // The editor reads its model once per key, so it is rebuilt with the proposed entry.
      model.value = { ...model.value, entry }
      editorVersion.value++
    }
  } catch (error) {
    failure.value = adminApiError(error).message
  }
}

async function load() {
  if (!props.entityId) {
    proposal.value = null
    entity.value = null
    resetFromEntity(null, props.prefill)
    return
  }
  loading.value = true
  failure.value = ''
  try {
    const result = await api.get(props.entityId)
    entity.value = result.entity
    resetFromEntity(result.entity)
    await loadProposal()
  } catch (error) {
    entity.value = null
    failure.value = adminApiError(error).message
  } finally {
    loading.value = false
  }
}

watch(() => [props.visible, props.entityId, props.proposalId] as const, ([visible]) => {
  if (visible) load()
}, { immediate: true })

async function requestClose() {
  if (!dirty.value || saving.value || await confirm({
    title: 'Odbaciti promjene?',
    description: 'Promjene u uređivaču još nisu spremljene.',
    confirmLabel: 'Odbaci promjene',
    cancelLabel: 'Nastavi uređivati',
    color: 'error'
  })) close()
}

function close() {
  emit('closed')
}

async function saveWithStatus(status: ContentStatus) {
  if (!model.value || saving.value) return
  saving.value = true
  failure.value = ''
  try {
    const body: Record<string, unknown> = { entry: model.value.entry, areas: model.value.areas, status }
    const submission = proposal.value?.submission
    if (entity.value && submission && !submission.appliedAt && submission.status !== 'rejected' && submission.type === 'correction') {
      body.applySubmissionId = submission.id
      body.applyCredit = proposalCredit.value
    }
    const result = entity.value
      ? await api.update(entity.value.id, { ...body, revision: conflict.value?.revision ?? entity.value.revision })
      : await api.create(body)
    conflict.value = null
    if (body.applySubmissionId) proposal.value = null
    toast.add({ title: 'Spremljeno', description: props.resource.label(result.entity), color: 'success', icon: 'i-lucide-check' })
    emit('saved', result.entity)
    close()
  } catch (error) {
    const problem = adminApiError(error)
    if (problem.code === 'revision-conflict' && problem.current) conflict.value = problem.current as unknown as Word
    else failure.value = problem.message
  } finally {
    saving.value = false
  }
}

async function saveActive(active: boolean) {
  await saveWithStatus(active ? 'published' : 'draft')
}

function loadLatest() {
  if (!conflict.value) return
  entity.value = conflict.value
  resetFromEntity(conflict.value)
  conflict.value = null
}

async function overwrite() {
  if (!conflict.value || !model.value) return
  await saveWithStatus(model.value.active ? 'published' : 'draft')
}
</script>

<template>
  <UModal
    :open="visible"
    fullscreen
    :title="title"
    :dismissible="false"
    :close="false"
    data-test="admin-word-dialog"
    @update:open="(value) => { if (!value) requestClose() }"
    @close:prevent="requestClose"
  >
    <template #actions>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        aria-label="Zatvori"
        class="ms-auto"
        @click="requestClose"
      />
    </template>
    <template #body>
      <div
        v-if="loading"
        class="flex flex-col gap-3 p-4"
        aria-busy="true"
      >
        <USkeleton class="h-8 w-full" />
        <USkeleton class="h-32 w-full" />
      </div>
      <div
        v-else
        class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6"
      >
        <AdminProposalBanner
          v-if="proposal"
          v-model:credit="proposalCredit"
          :detail="proposal"
        />
        <UAlert
          v-if="conflict"
          color="warning"
          variant="subtle"
          icon="i-lucide-git-compare"
          title="Netko je u međuvremenu spremio ovu riječ."
          :actions="[
            { label: 'Učitaj najnovije', color: 'neutral', variant: 'outline', onClick: loadLatest },
            { label: 'Prepiši', color: 'warning', onClick: overwrite }
          ]"
          role="alert"
        />
        <UAlert
          v-if="failure"
          color="error"
          variant="subtle"
          :title="failure"
          role="alert"
        />
        <HeritageWordEditor
          v-if="model"
          :key="editorVersion"
          v-model="model"
          :busy="saving"
          @save="saveActive"
          @cancel="requestClose"
        />
      </div>
    </template>
  </UModal>
</template>
