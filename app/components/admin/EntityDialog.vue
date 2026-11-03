<script setup lang="ts" generic="T extends ContentEntity, F extends object">
import type { FormError } from '@nuxt/ui'
import type { ContentEntity, ContentIssue, ContentStatus } from '~~/shared/utils/content/common'
import { CONTENT_STATUS_LABELS } from '~~/shared/utils/content/common'
import type { AdminResource } from '~/composables/useAdminResource'

// Create and edit one entity in a modal. Fields come from the page's `#fields` slot; the
// dialog owns loading, the shared validator, saving with the row's revision, server issues on
// fields, revision conflicts, the unsaved-changes guard and Ctrl/⌘+S.
const props = defineProps<{
  resource: AdminResource<T, F>
  /** The entity to edit; without it the dialog creates a new one. */
  entityId?: string
  /** Initial values for a new entity (from `?novo=1&<field>=…`). */
  prefill?: Partial<F>
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [entity: T] }>()
defineSlots<{
  fields?(props: { state: F, entity: T | null }): unknown
  advanced?(props: { state: F, entity: T | null }): unknown
}>()

const api = useAdminContentApi<T>(props.resource.kind)
const toast = useToast()
const confirm = useAdminConfirm()

const form = useTemplateRef('form')
const state = ref(props.resource.blank()) as Ref<F>
const entity = ref<T | null>(null) as Ref<T | null>
const legacyIds = ref<string[]>([])
const baseline = ref('')
const loading = ref(false)
const saving = ref(false)
const failure = ref('')
const formIssues = ref<string[]>([])
const conflict = ref<T | null>(null) as Ref<T | null>
const nextStatus = ref<ContentStatus>('published')
const addAnother = ref(false)

const isEdit = computed(() => !!props.entityId)
const title = computed(() => isEdit.value ? props.resource.labels.edit : props.resource.labels.create)
const dirty = computed(() => !loading.value && JSON.stringify(state.value) !== baseline.value)
const status = computed<ContentStatus>(() => entity.value?.status ?? 'draft')

function reset(value: F) {
  state.value = value
  baseline.value = JSON.stringify(value)
  failure.value = ''
  formIssues.value = []
  conflict.value = null
  form.value?.clear()
}

async function load() {
  if (!props.entityId) {
    entity.value = null
    legacyIds.value = []
    reset({ ...props.resource.blank(), ...props.prefill })
    return
  }
  loading.value = true
  failure.value = ''
  try {
    const result = await api.get(props.entityId)
    entity.value = result.entity
    legacyIds.value = result.legacyIds
    reset(props.resource.toForm(result.entity))
  } catch (error) {
    entity.value = null
    failure.value = adminApiError(error).message
  } finally {
    loading.value = false
  }
}

watch(() => [open.value, props.entityId] as const, ([isOpen]) => {
  if (isOpen) load()
}, { immediate: true })

function toFormErrors(issues: ContentIssue[]): FormError[] {
  return issues.filter(issue => issue.path).map(issue => ({ name: issue.path, message: issue.message }))
}

function validate(value: Partial<F>) {
  const issues = props.resource.validate(value as F)
  formIssues.value = issues.filter(issue => !issue.path).map(issue => issue.message)
  return toFormErrors(issues)
}

/** The footer buttons choose the status, then submit the form, which validates first. */
function requestSave(statusToSave: ContentStatus, another = false) {
  nextStatus.value = statusToSave
  addAnother.value = another
  form.value?.submit()
}

async function save(revisionOverride?: number) {
  saving.value = true
  failure.value = ''
  try {
    const body = { ...state.value, status: nextStatus.value }
    const result = entity.value
      ? await api.update(entity.value.id, { ...body, revision: revisionOverride ?? entity.value.revision })
      : await api.create(body)
    conflict.value = null
    toast.add({ title: 'Spremljeno', description: props.resource.label(result.entity), color: 'success', icon: 'i-lucide-check' })
    emit('saved', result.entity)
    if (addAnother.value && !entity.value) {
      reset({ ...props.resource.blank() })
    } else {
      baseline.value = JSON.stringify(state.value)
      open.value = false
    }
  } catch (error) {
    const problem = adminApiError(error)
    if (problem.code === 'revision-conflict' && problem.current) {
      conflict.value = problem.current as T
    } else {
      failure.value = problem.message
      if (problem.issues?.length) {
        form.value?.setErrors(toFormErrors(problem.issues))
        formIssues.value = problem.issues.filter(issue => !issue.path).map(issue => issue.message)
      }
    }
  } finally {
    saving.value = false
  }
}

/** Discards local edits and continues from the row someone else saved. */
function loadLatest() {
  if (!conflict.value) return
  entity.value = conflict.value
  reset(props.resource.toForm(conflict.value))
}

/** Saves these edits over the newer row. */
function overwrite() {
  if (!conflict.value) return
  const revision = conflict.value.revision
  conflict.value = null
  save(revision)
}

async function requestClose() {
  if (saving.value) return
  if (dirty.value && !await confirm({
    title: 'Odbaciti promjene?',
    description: 'Promjene u ovom obrascu još nisu spremljene.',
    confirmLabel: 'Odbaci promjene',
    cancelLabel: 'Nastavi uređivati',
    color: 'error'
  })) return
  open.value = false
}

const primaryAction = computed(() => {
  if (!entity.value || status.value === 'draft') return { label: 'Objavi', status: 'published' as const }
  return { label: 'Spremi', status: status.value }
})

defineShortcuts({
  meta_s: {
    usingInput: true,
    handler: () => {
      if (open.value && !saving.value && !loading.value) requestSave(primaryAction.value.status)
    }
  }
})

async function copyId() {
  if (!entity.value) return
  try {
    await navigator.clipboard.writeText(entity.value.id)
    toast.add({ title: 'UUID je kopiran.', color: 'neutral', icon: 'i-lucide-copy' })
  } catch {
    toast.add({ title: 'Kopiranje nije uspjelo.', color: 'error' })
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('hr-HR')
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :description="entity ? resource.label(entity) : resource.labels.description"
    :dismissible="false"
    :close="false"
    :ui="{ content: resource.dialogWidth === 'wide' ? 'sm:max-w-4xl' : 'sm:max-w-2xl', footer: 'flex-wrap justify-end' }"
    data-test="admin-entity-dialog"
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
        class="flex flex-col gap-3"
        aria-busy="true"
      >
        <USkeleton class="h-8 w-full" />
        <USkeleton class="h-8 w-2/3" />
        <USkeleton class="h-20 w-full" />
      </div>
      <UForm
        v-else
        ref="form"
        :state="state"
        :validate="validate"
        :validate-on="['blur', 'change']"
        :disabled="saving"
        class="flex flex-col gap-4"
        @submit="save()"
      >
        <UAlert
          v-if="conflict"
          color="warning"
          variant="subtle"
          icon="i-lucide-git-compare"
          title="Netko je u međuvremenu spremio ovaj zapis."
          :description="`Spremljena verzija je izmijenjena ${formatDate(conflict.updatedAt)}. Učitaj je (tvoje promjene se odbacuju) ili je prepiši svojim promjenama.`"
          :actions="[
            { label: 'Učitaj najnovije', color: 'neutral', variant: 'outline', onClick: loadLatest },
            { label: 'Prepiši', color: 'warning', onClick: overwrite }
          ]"
          role="alert"
          data-test="admin-conflict"
        />
        <UAlert
          v-if="failure"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="failure"
          :description="formIssues.join(' ') || undefined"
          role="alert"
        />

        <slot
          name="fields"
          :state="state"
          :entity="entity"
        />

        <UCollapsible
          v-if="entity || $slots.advanced"
          class="rounded-md border border-default"
        >
          <UButton
            label="Napredno"
            color="neutral"
            variant="ghost"
            trailing-icon="i-lucide-chevron-down"
            block
            class="justify-between"
          />
          <template #content>
            <div class="flex flex-col gap-4 p-3 pt-1">
              <slot
                name="advanced"
                :state="state"
                :entity="entity"
              />
              <dl
                v-if="entity"
                class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]"
              >
                <dt class="text-muted">
                  UUID
                </dt>
                <dd class="flex items-center gap-2">
                  <code class="break-all text-xs">{{ entity.id }}</code>
                  <UButton
                    icon="i-lucide-copy"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    aria-label="Kopiraj UUID"
                    @click="copyId"
                  />
                </dd>
                <template v-if="legacyIds.length">
                  <dt class="text-muted">
                    Stari identifikatori
                  </dt>
                  <dd class="break-all text-xs">
                    <code>{{ legacyIds.join(', ') }}</code>
                  </dd>
                </template>
                <dt class="text-muted">
                  Status
                </dt>
                <dd>{{ CONTENT_STATUS_LABELS[entity.status] }} · revizija {{ entity.revision }}</dd>
                <dt class="text-muted">
                  Izmijenjeno
                </dt>
                <dd>{{ formatDate(entity.updatedAt) }}</dd>
              </dl>
            </div>
          </template>
        </UCollapsible>
      </UForm>
    </template>

    <template #footer>
      <UButton
        label="Odustani"
        color="neutral"
        variant="ghost"
        :disabled="saving"
        @click="requestClose"
      />
      <UButton
        v-if="!isEdit"
        label="Spremi i dodaj novo"
        color="neutral"
        variant="outline"
        :disabled="loading || saving"
        data-test="admin-save-another"
        @click="requestSave('published', true)"
      />
      <UButton
        v-if="!entity || status === 'draft'"
        label="Spremi skicu"
        color="neutral"
        variant="subtle"
        :disabled="loading || saving || (isEdit && !entity)"
        data-test="admin-save-draft"
        @click="requestSave('draft')"
      />
      <UButton
        :label="primaryAction.label"
        icon="i-lucide-check"
        :loading="saving"
        :disabled="loading || (isEdit && !entity)"
        data-test="admin-save"
        @click="requestSave(primaryAction.status)"
      >
        <template #trailing>
          <UKbd
            value="meta"
            size="sm"
            class="hidden sm:inline-flex"
          />
          <UKbd
            value="s"
            size="sm"
            class="hidden sm:inline-flex"
          />
        </template>
      </UButton>
    </template>
  </UModal>
</template>
