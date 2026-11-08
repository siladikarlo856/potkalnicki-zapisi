<script setup lang="ts">
import type { InboxDetail, InboxDraftResult, InboxRow } from '~~/shared/types/inbox'
import { CONTRIBUTION_ADMIN_PATHS, CONTRIBUTION_KIND_LABELS } from '~~/shared/utils/contribution'
import { createdAdminPath, MEMORY_DRAFT_KINDS, MEMORY_DRAFT_KIND_LABELS } from '~~/shared/utils/memoryDraft'
import type { MemoryDraftKind } from '~~/shared/utils/memoryDraft'
import type { SubmissionStatus } from '~~/shared/utils/submission'
import { INTENT_LABELS, SUBMISSION_TYPE_LABELS } from '~/utils/inbox'

// The expanded row of the inbox: what was sent, what a correction would change (current → proposed), and the
// actions. Everything is rendered as plain text; links the sender typed are never turned into links here.
const props = defineProps<{ row: InboxRow }>()
const emit = defineEmits<{ changed: [] }>()

const confirm = useAdminConfirm()
const toast = useToast()
const busy = ref(false)
const error = ref('')
const detail = ref<InboxDetail | null>(null)
const detailError = ref('')

const row = computed(() => props.row)
const applied = computed(() => !!row.value.appliedAt)
const structured = computed(() => row.value.type === 'correction' || row.value.type === 'proposal')

async function loadDetail() {
  if (!structured.value) return
  try {
    detail.value = await $fetch<InboxDetail>(`/api/admin/inbox/${row.value.id}`)
  } catch (e) {
    detailError.value = adminApiError(e).message
  }
}
onMounted(loadDetail)
watch(() => [row.value.id, row.value.status, row.value.appliedAt], loadDetail)

function formatDate(value: string) {
  return new Date(`${value.replace(' ', 'T')}Z`).toLocaleString('hr-HR')
}

async function run(action: () => Promise<unknown>) {
  busy.value = true
  error.value = ''
  try {
    await action()
  } catch (e) {
    error.value = adminApiError(e).message
  } finally {
    busy.value = false
  }
}

/** A correction is applied in the target's own edit dialog, with the proposed values filled in. */
function apply() {
  const target = row.value.target
  if (!target?.id || !row.value.targetKind) return
  return navigateTo({ path: CONTRIBUTION_ADMIN_PATHS[row.value.targetKind], query: { uredi: target.id, prijedlog: String(row.value.id) } })
}

function openDraft() {
  return run(async () => {
    const result = await $fetch<InboxDraftResult>(`/api/admin/inbox/${row.value.id}/draft`, { method: 'POST' })
    // Words keep their own flow: activating the draft approves the submission.
    const query: Record<string, string> = { uredi: result.id }
    if (result.kind !== 'word') query.prijedlog = String(row.value.id)
    await navigateTo({ path: CONTRIBUTION_ADMIN_PATHS[result.kind], query })
  })
}

async function setStatus(status: SubmissionStatus) {
  if (status === 'rejected') {
    const made = row.value.created
    if (!await confirm({
      title: `Odbiti prijedlog #${row.value.id}?`,
      description: made && made.status === 'published'
        ? 'Zapis nastao iz ovog prijedloga vraća se u skice i uklanja se zahvala doprinositelju.'
        : 'Prijedlog se označava kao odbijen. Možeš ga kasnije vratiti na čekanje.',
      confirmLabel: 'Odbij'
    })) return
  }
  await run(async () => {
    await $fetch(`/api/admin/inbox/${row.value.id}`, { method: 'PATCH', body: { status } })
    emit('changed')
  })
}

async function remove() {
  if (!await confirm({
    title: `Obrisati prijedlog #${row.value.id}?`,
    description: applied.value
      ? 'Primijenjena izmjena ostaje u zapisu, ali se uklanja zahvala doprinositelju, i iz povijesti izmjena.'
      : 'Prijedlog se trajno briše zajedno s imenom i kontaktom. Zahvala doprinositelju i zapis nastao iz prijedloga se povlače.',
    confirmLabel: 'Obriši',
    color: 'error'
  })) return
  await run(async () => {
    await $fetch(`/api/admin/inbox/${row.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Prijedlog je obrisan', color: 'neutral', icon: 'i-lucide-trash-2' })
    emit('changed')
  })
}

const appliedPath = computed(() => row.value.targetKind
  ? { path: CONTRIBUTION_ADMIN_PATHS[row.value.targetKind], query: { uredi: row.value.appliedEntityId ?? '' } }
  : undefined)
const createdPath = computed(() => row.value.created
  ? { path: createdAdminPath(row.value.created.kind), query: { uredi: row.value.created.id } }
  : undefined)

// A Memory can become a Story, Custom or Folk text (a Draft the editor finishes); it keeps its separate word flow.
const isMemory = computed(() => row.value.type === 'memory')
const memoryDraft = computed(() => row.value.created && (MEMORY_DRAFT_KINDS as readonly string[]).includes(row.value.created.kind) ? row.value.created : null)
const memoryDialogOpen = ref(false)

/** Opens the Draft made from the Memory in its editor, with the Memory's banner and credit choice. */
function openMemoryDraft() {
  if (!memoryDraft.value) return
  return navigateTo({ path: createdAdminPath(memoryDraft.value.kind), query: { uredi: memoryDraft.value.id, prijedlog: String(row.value.id) } })
}
</script>

<template>
  <div
    class="flex flex-col gap-4"
    data-test="admin-inbox-detail"
  >
    <p class="text-sm text-dimmed">
      #{{ row.id }} · {{ formatDate(row.createdAt) }}
    </p>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="error"
      role="alert"
    />
    <UAlert
      v-if="detail?.stale"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Zapis je izmijenjen nakon što je ispravak poslan."
      description="Provjeri trenutne vrijednosti prije primjene."
      data-test="admin-inbox-stale"
    />

    <p class="whitespace-pre-line text-highlighted">
      {{ row.text }}
    </p>

    <div
      v-if="detail?.changes.length"
      class="overflow-x-auto rounded-lg ring ring-default"
    >
      <table
        class="w-full text-sm"
        data-test="admin-inbox-changes"
      >
        <caption class="sr-only">
          {{ row.type === 'correction' ? 'Trenutne i predložene vrijednosti' : 'Polja prijedloga' }}
        </caption>
        <thead class="text-left text-muted">
          <tr>
            <th class="p-2 font-medium">
              Polje
            </th>
            <th
              v-if="row.type === 'correction'"
              class="p-2 font-medium"
            >
              Trenutno
            </th>
            <th class="p-2 font-medium">
              {{ row.type === 'correction' ? 'Predloženo' : 'Vrijednost' }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="change in detail.changes"
            :key="change.field"
            class="border-t border-default align-top"
          >
            <th class="p-2 text-left font-medium">
              {{ change.label }}
            </th>
            <td
              v-if="row.type === 'correction'"
              class="whitespace-pre-line break-words p-2 text-muted"
            >
              {{ change.current ?? '—' }}
            </td>
            <td class="whitespace-pre-line break-words p-2">
              <mark class="rounded bg-primary/15 px-1 text-highlighted">{{ change.proposed }}</mark>
              <span
                v-if="row.type === 'correction' && !change.applicable"
                class="mt-1 block text-xs text-dimmed"
              >Samo za informaciju.</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p
      v-else-if="detailError"
      class="text-sm text-error"
    >
      {{ detailError }}
    </p>

    <dl class="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
      <dt class="text-muted">
        Vrsta
      </dt>
      <dd>{{ row.type ? SUBMISSION_TYPE_LABELS[row.type] : '—' }}</dd>
      <template v-if="row.targetKind">
        <dt class="text-muted">
          Odnosi se na
        </dt>
        <dd
          class="break-words"
          data-test="admin-inbox-target"
        >
          {{ CONTRIBUTION_KIND_LABELS[row.targetKind] }}<template v-if="row.target">
            ·
            <ULink
              v-if="row.target.state === 'ok' && row.target.id"
              :to="{ path: CONTRIBUTION_ADMIN_PATHS[row.targetKind], query: { uredi: row.target.id } }"
              class="text-primary underline underline-offset-2"
            >{{ row.target.label }}</ULink>
            <span v-else>{{ row.target.label || 'nepoznato' }} (obrisano ili nepoznato)</span>
          </template>
        </dd>
      </template>
      <template v-if="row.wordId">
        <dt class="text-muted">
          Riječ
        </dt>
        <dd
          class="break-words"
          data-testid="submission-word"
        >
          <ULink
            :to="{ path: '/admin/rijeci', query: { uredi: row.wordId } }"
            class="text-primary underline underline-offset-2"
            lang="hr"
          >
            {{ row.wordHeadword || row.wordId }}
          </ULink>
          <template v-if="row.intent">
            · {{ INTENT_LABELS[row.intent] }}
          </template>
        </dd>
      </template>
      <template v-if="row.created">
        <dt class="text-muted">
          {{ isMemory ? 'Nastalo iz sjećanja' : 'Nastalo iz prijedloga' }}
        </dt>
        <dd data-test="admin-inbox-created">
          <ULink
            :to="createdPath"
            class="text-primary underline underline-offset-2"
          >
            {{ row.created.label || 'bez naziva' }}
          </ULink>
          <template v-if="memoryDraft">
            ({{ MEMORY_DRAFT_KIND_LABELS[memoryDraft.kind as MemoryDraftKind] }})
          </template>
          · {{ row.created.status === 'published' ? 'objavljeno' : row.created.status === 'draft' ? 'skica' : 'arhivirano' }}
        </dd>
      </template>
      <dt class="text-muted">
        Mjesto
      </dt>
      <dd class="break-words">
        {{ row.place || '—' }}
        <span
          v-if="row.placeContext"
          class="block text-muted"
        >{{ row.placeContext }}</span>
      </dd>
      <dt class="text-muted">
        Ime
      </dt>
      <dd>{{ row.name || 'Anonimno' }}</dd>
      <dt class="text-muted">
        Kontakt
      </dt>
      <dd class="break-all">
        {{ row.contact || '—' }}
      </dd>
      <dt class="text-muted">
        Jezik
      </dt>
      <dd>{{ row.locale.toUpperCase() }}</dd>
      <dt class="text-muted">
        Privola
      </dt>
      <dd>{{ row.consentPublish ? `Dana (obavijest ${row.consentVersion})` : '—' }}</dd>
      <template v-if="applied">
        <dt class="text-muted">
          Primijenjeno
        </dt>
        <dd data-test="admin-inbox-applied">
          {{ formatDate(row.appliedAt!) }}
          <template v-if="appliedPath && row.appliedEntityId">
            ·
            <ULink
              :to="appliedPath"
              class="text-primary underline underline-offset-2"
            >otvori zapis</ULink>
          </template>
        </dd>
      </template>
    </dl>

    <p
      v-if="row.intent === 'usage'"
      class="text-sm text-muted"
      data-testid="usage-note"
    >
      Potvrda upotrebe potvrđuje postojeću riječ, pa se ne pretvara u novu skicu. Mjesto možeš ručno dodati u riječ u uređivaču riječi.
    </p>

    <div class="flex flex-wrap gap-2">
      <UButton
        v-if="row.type === 'correction' && !applied && row.status !== 'rejected'"
        label="Primijeni"
        icon="i-lucide-git-pull-request-arrow"
        :disabled="busy || row.target?.state !== 'ok' || !row.target?.id"
        data-test="admin-inbox-apply"
        @click="apply"
      />
      <UButton
        v-if="isMemory && row.status !== 'rejected' && !applied"
        :label="memoryDraft ? 'Otvori skicu' : 'Započni skicu priče, običaja ili teksta'"
        icon="i-lucide-scroll-text"
        :disabled="busy"
        data-test="admin-inbox-memory-draft"
        @click="memoryDraft ? openMemoryDraft() : (memoryDialogOpen = true)"
      />
      <UButton
        v-if="row.canDraft && row.status !== 'rejected' && !memoryDraft"
        :label="row.created ? 'Otvori skicu' : row.type === 'proposal' ? 'Otvori skicu' : 'Dodaj u riječi / otvori skicu'"
        icon="i-lucide-file-plus"
        :loading="busy"
        data-test="admin-inbox-draft"
        @click="openDraft"
      />
      <UButton
        v-if="!applied && row.status === 'pending'"
        label="Odobri bez izmjene"
        icon="i-lucide-check"
        color="success"
        variant="subtle"
        :disabled="busy"
        data-test="admin-inbox-approve"
        @click="setStatus('approved')"
      />
      <UButton
        v-if="!applied && row.status !== 'rejected'"
        label="Odbij"
        icon="i-lucide-x"
        color="neutral"
        variant="subtle"
        :disabled="busy"
        data-test="admin-inbox-reject"
        @click="setStatus('rejected')"
      />
      <UButton
        v-if="!applied && row.status !== 'pending'"
        label="Vrati na čekanje"
        icon="i-lucide-undo-2"
        color="neutral"
        variant="ghost"
        :disabled="busy"
        @click="setStatus('pending')"
      />
      <UButton
        label="Obriši"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        class="sm:ml-auto"
        :disabled="busy"
        data-test="admin-inbox-delete"
        @click="remove"
      />
    </div>
    <AdminMemoryDraftDialog
      v-if="isMemory"
      v-model:open="memoryDialogOpen"
      :row="row"
    />
  </div>
</template>
