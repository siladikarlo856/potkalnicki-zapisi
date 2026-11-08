<script setup lang="ts">
import type { InboxMemoryDraftResult, InboxRow } from '#shared/types/inbox'
import type { ContentList } from '#shared/utils/content/common'
import type { KeyedListEntry } from '#shared/utils/content/intangibleList'
import { MEMORY_DRAFT_ADMIN_PATHS, MEMORY_DRAFT_KINDS, MEMORY_DRAFT_KIND_LABELS } from '#shared/utils/memoryDraft'
import type { MemoryDraftKind } from '#shared/utils/memoryDraft'

// "Započni skicu" on a Memory: the editor chooses what the Memory becomes (a Story, a Custom or a Folk text) and its
// type, and the server starts the Draft from the sender's text. The editor then finishes it in the kind's own page;
// publishing it applies the Memory and thanks a named, consenting sender.
const props = defineProps<{ row: InboxRow }>()
const open = defineModel<boolean>('open', { default: false })

const TYPE_LISTS = { story: 'story_type', custom: 'custom_type', folk_text: 'folk_text_type' } as const
const kinds = MEMORY_DRAFT_KINDS.map(value => ({ label: MEMORY_DRAFT_KIND_LABELS[value], value }))

const kind = ref<MemoryDraftKind>('story')
const typeId = ref<string | undefined>()
const types = ref<Array<{ label: string, value: string }>>([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')

async function loadTypes() {
  loading.value = true
  error.value = ''
  types.value = []
  typeId.value = undefined
  try {
    const result = await $fetch<ContentList<KeyedListEntry>>(`/api/admin/content/${TYPE_LISTS[kind.value]}`, { query: { size: 100, sort: 'sort', status: 'published' } })
    types.value = result.rows.map(entry => ({ label: entry.labelHr, value: entry.id }))
  } catch (e) {
    error.value = adminApiError(e).message
  } finally {
    loading.value = false
  }
}

watch([open, kind], ([isOpen]) => {
  if (isOpen) loadTypes()
}, { immediate: true })

async function start() {
  if (!typeId.value) return
  busy.value = true
  error.value = ''
  try {
    const result = await $fetch<InboxMemoryDraftResult>(`/api/admin/inbox/${props.row.id}/memory-draft`, {
      method: 'POST', body: { kind: kind.value, typeId: typeId.value }
    })
    open.value = false
    await navigateTo({ path: MEMORY_DRAFT_ADMIN_PATHS[result.kind], query: { uredi: result.id, prijedlog: String(props.row.id) } })
  } catch (e) {
    error.value = adminApiError(e).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Započni skicu iz sjećanja"
    :description="`Sjećanje #${row.id}`"
    data-test="admin-memory-draft-dialog"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-muted">
          Skica počinje tekstom sjećanja. Zatim je dovršiš u uređivaču, a objava skice odobrava sjećanje i navodi pošiljatelja u zahvalama
          (samo ako je imenovan i dao privolu). Iz jednog sjećanja nastaje jedna skica.
        </p>
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="error"
          role="alert"
        />
        <UFormField
          label="Što je to sjećanje?"
          required
        >
          <URadioGroup
            v-model="kind"
            :items="kinds"
            orientation="horizontal"
            data-test="admin-memory-draft-kind"
          />
        </UFormField>
        <UFormField
          label="Vrsta"
          required
          :description="types.length || loading ? undefined : 'Prvo dodaj vrstu na odgovarajućoj stranici popisa.'"
        >
          <USelect
            v-model="typeId"
            :items="types"
            :loading="loading"
            placeholder="Odaberi vrstu"
            class="w-full"
            data-test="admin-memory-draft-type"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton
          label="Odustani"
          color="neutral"
          variant="ghost"
          :disabled="busy"
          @click="open = false"
        />
        <UButton
          label="Započni skicu"
          icon="i-lucide-file-plus"
          :loading="busy"
          :disabled="!typeId"
          data-test="admin-memory-draft-start"
          @click="start"
        />
      </div>
    </template>
  </UModal>
</template>
