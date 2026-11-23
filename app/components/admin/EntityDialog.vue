<script setup lang="ts" generic="T extends ContentEntity, F extends object">
import type { FormError, FormErrorEvent } from '@nuxt/ui'
import type { RouteLocationNormalized } from 'vue-router'
import type { InboxDetail } from '~~/shared/types/inbox'
import type { ContentEntity, ContentIssue, ContentStatus } from '~~/shared/utils/content/common'
import { CONTENT_STATUS_LABELS } from '~~/shared/utils/content/common'
import { expandHistoryChange, historyFieldMeta } from '~~/shared/utils/content/history'
import type { AdminResource } from '~/composables/useAdminResource'
import type { SaveBarAction, SaveBarState } from '~/components/admin/SaveBar.vue'

const $fetch = useEditorialFetch()

// Create and edit one entity. Fields come from the page's `#fields` slot; this component owns loading, the shared validator,
// saving with the row's revision, server issues on fields, revision conflicts, the unsaved-changes guard, the copy kept in
// the browser, the session-expired dialog and Ctrl/⌘+S.
//
// `mode="dialog"` (the default, for the short lookup resources) shows it in a modal; `mode="page"` shows it as the editor page
// of the design (main column, side column, save bar) in place of the list.
const props = withDefaults(defineProps<{
  resource: AdminResource<T, F>
  /** The entity to edit; without it the dialog creates a new one. */
  entityId?: string
  /** Initial values for a new entity (from `?novo=1&<field>=…`). */
  prefill?: Partial<F>
  /** A correction or proposal from the inbox (`?prijedlog=<id>`): shown above the form and applied on save. */
  proposalId?: number
  mode?: 'dialog' | 'page'
}>(), { mode: 'dialog' })
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [entity: T] }>()
defineSlots<{
  fields?(props: { state: F, entity: T | null }): unknown
  advanced?(props: { state: F, entity: T | null }): unknown
  side?(props: { state: F, entity: T | null }): unknown
}>()

const api = useAdminContentApi<T>(props.resource.kind)
const toast = useToast()
const confirm = useAdminConfirm()
const chooseUnsaved = useAdminUnsavedChoice()
const router = useRouter()

const form = useTemplateRef('form')
const formId = useId()
const state = ref(props.resource.blank()) as Ref<F>
const entity = ref<T | null>(null) as Ref<T | null>
const legacyIds = ref<string[]>([])
const baseline = ref('')
const loading = ref(false)
const saving = ref(false)
const failure = ref('')
const saveFailed = ref(false)
const formIssues = ref<string[]>([])
const errorCount = ref(0)
const justSaved = ref(false)
const conflict = ref<T | null>(null) as Ref<T | null>
const comparing = ref(false)
const nextStatus = ref<ContentStatus>('published')
const addAnother = ref(false)
const proposal = ref<InboxDetail | null>(null)
const proposalCredit = ref(true)
const restoredAt = ref<string | null>(null)
const historyOpen = ref(false)
const deleteOpen = ref(false)

const isPage = computed(() => props.mode === 'page')
const isEdit = computed(() => !!props.entityId)
const title = computed(() => isEdit.value ? props.resource.labels.edit : props.resource.labels.create)
// A closed editor has nothing to lose: its blank state never counts as changes, so the list's own navigation is not held back.
const dirty = computed(() => open.value && !loading.value && JSON.stringify(state.value) !== baseline.value)
const status = computed<ContentStatus>(() => entity.value?.status ?? 'draft')
const readOnly = computed(() => entity.value?.status === 'archived')

/** The top-level fields that differ from what was loaded or last saved. */
const changedFields = computed(() => {
  if (!baseline.value) return []
  const saved = JSON.parse(baseline.value) as Record<string, unknown>
  const now = state.value as Record<string, unknown>
  return Object.keys(now).filter(key => JSON.stringify(now[key] ?? null) !== JSON.stringify(saved[key] ?? null))
})

// The copy kept in the browser per record, offered back after a crash or an expired session.
const draftKey = computed(() => `admin-draft:${props.resource.kind}:${props.entityId ?? 'novo'}`)
function readDraft(): { savedAt: string, revision?: number, state: F } | null {
  try {
    const raw = localStorage.getItem(draftKey.value)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function forgetDraft(key = draftKey.value) {
  try {
    localStorage.removeItem(key)
  } catch { /* nothing kept */ }
}
/** The revision the form's edits started from, kept with the copy so an older one is never saved over a newer row. */
let draftRevision: number | undefined
let keepTimer: ReturnType<typeof setTimeout> | undefined
function keepDraft() {
  clearTimeout(keepTimer)
  const key = draftKey.value
  keepTimer = setTimeout(() => {
    try {
      if (dirty.value && !saving.value) localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), revision: draftRevision, state: state.value }))
    } catch { /* storage full or unavailable: the form itself still has everything */ }
  }, 400)
}
watch(state, () => {
  if (dirty.value) justSaved.value = false
  if (open.value && !loading.value) keepDraft()
}, { deep: true })
onBeforeUnmount(() => clearTimeout(keepTimer))

function reset(value: F) {
  state.value = value
  draftRevision = entity.value?.revision
  baseline.value = JSON.stringify(value)
  failure.value = ''
  saveFailed.value = false
  formIssues.value = []
  errorCount.value = 0
  conflict.value = null
  comparing.value = false
  restoredAt.value = null
  form.value?.clear()
}

function restoreDraft() {
  if (props.proposalId) return
  const kept = readDraft()
  if (!kept || JSON.stringify(kept.state) === baseline.value) return
  state.value = { ...props.resource.blank(), ...kept.state }
  restoredAt.value = kept.savedAt
  draftRevision = kept.revision
  // A copy kept from an older revision is compared with the saved row, as any other conflict, before it can be saved.
  if (entity.value && kept.revision !== entity.value.revision) conflict.value = entity.value
}

function discardRestored() {
  forgetDraft()
  reset(JSON.parse(baseline.value) as F)
}

/**
 * Loads the submission named by `?prijedlog=`. A correction for this entity puts its proposed values into the form
 * (the saved baseline stays as it was, so the dialog counts as changed); a proposal's draft only shows its context.
 */
async function loadProposal() {
  proposal.value = null
  proposalCredit.value = true
  if (!props.proposalId) return
  try {
    const detail = await $fetch<InboxDetail>(`/api/admin/inbox/${props.proposalId}`)
    proposal.value = detail
    if (detail.patch && detail.submission.targetId === props.entityId && !detail.submission.appliedAt) {
      state.value = { ...state.value, ...detail.patch } as F
    }
  } catch (error) {
    failure.value = adminApiError(error).message
  }
}

const loadFailed = ref(false)
async function load() {
  loadFailed.value = false
  if (!props.entityId) {
    entity.value = null
    legacyIds.value = []
    proposal.value = null
    reset({ ...props.resource.blank(), ...props.prefill })
    restoreDraft()
    return
  }
  loading.value = true
  failure.value = ''
  try {
    const result = await api.get(props.entityId)
    entity.value = result.entity
    legacyIds.value = result.legacyIds
    reset(props.resource.toForm(result.entity))
    restoreDraft()
    await loadProposal()
  } catch (error) {
    entity.value = null
    failure.value = adminApiError(error).message
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

watch(() => [open.value, props.entityId, props.proposalId] as const, ([isOpen]) => {
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

function onFormError(event: FormErrorEvent) {
  pendingExit = undefined
  errorCount.value = new Set(event.errors.map(error => error.name)).size + formIssues.value.length
  saveFailed.value = false
}

/** The footer buttons choose the status, then submit the form, which validates first. */
function requestSave(statusToSave: ContentStatus, another = false) {
  nextStatus.value = statusToSave
  addAnother.value = another
  form.value?.submit()
}

// A save refused because the session ended waits for the password, then runs again (see useAdminEditing).
let pendingResave: (() => void) | undefined
// Where "Spremi skicu i izađi" goes once the draft is saved: closing the editor, or the navigation it held back.
let pendingExit: (() => unknown) | undefined
useAdminEditing(() => open.value, () => pendingResave?.())

async function save(revisionOverride?: number) {
  const exit = pendingExit
  pendingExit = undefined
  // A conflict is settled in the diff ("Učitaj najnovije" or saving over it), never by an ordinary save.
  if (conflict.value && revisionOverride === undefined) return
  saving.value = true
  failure.value = ''
  saveFailed.value = false
  errorCount.value = 0
  try {
    const body: Record<string, unknown> = { ...state.value, status: nextStatus.value }
    // Saving applies the submission, in the same write: a correction on any save, a proposal's draft when published.
    const submission = proposal.value?.submission
    if (entity.value && submission && !submission.appliedAt && submission.status !== 'rejected'
      && (submission.type === 'correction' || nextStatus.value === 'published')) {
      body.applySubmissionId = submission.id
      body.applyCredit = proposalCredit.value
    }
    const result = entity.value
      ? await api.update(entity.value.id, { ...body, revision: revisionOverride ?? entity.value.revision })
      : await api.create(body)
    conflict.value = null
    comparing.value = false
    if (body.applySubmissionId) proposal.value = null
    forgetDraft()
    const wasNew = !entity.value
    const published = nextStatus.value === 'published'
    toast.add({
      title: published ? 'Objavljeno maloprije' : 'Spremljeno',
      description: published && !isPage.value ? props.resource.label(result.entity) : published ? 'Izmjene su objavljene.' : props.resource.label(result.entity),
      color: 'success',
      icon: 'i-lucide-check',
      actions: isPage.value && published && props.resource.publicPath?.(result.entity)
        ? [{ label: 'Pogledaj', color: 'neutral', variant: 'outline', to: props.resource.publicPath(result.entity), target: '_blank' }]
        : undefined
    })
    emit('saved', result.entity)
    if (addAnother.value && wasNew) {
      reset({ ...props.resource.blank() })
    } else if (isPage.value) {
      entity.value = result.entity
      reset(props.resource.toForm(result.entity))
      justSaved.value = true
    } else {
      baseline.value = JSON.stringify(state.value)
      open.value = false
    }
    // Navigating runs the editor's own route guards, which hold everything back while saving.
    saving.value = false
    if (exit) await exit()
    else if (isPage.value && wasNew && !addAnother.value) await router.replace({ query: { ...router.currentRoute.value.query, novo: undefined, uredi: result.entity.id } })
  } catch (error) {
    const problem = adminApiError(error)
    if (problem.statusCode === 401) {
      // The session ended: the sign-in dialog is over the form, and this save runs again after it.
      const statusToSave = nextStatus.value
      const another = addAnother.value
      pendingResave = () => {
        pendingResave = undefined
        pendingExit = exit
        requestSave(statusToSave, another)
      }
    } else if (problem.code === 'revision-conflict' && problem.current) {
      conflict.value = problem.current as T
    } else {
      failure.value = problem.message
      saveFailed.value = true
      if (problem.issues?.length) {
        saveFailed.value = false
        form.value?.setErrors(toFormErrors(problem.issues))
        formIssues.value = problem.issues.filter(issue => !issue.path).map(issue => issue.message)
        errorCount.value = new Set(problem.issues.map(issue => issue.path || issue.message)).size
      }
    }
  } finally {
    saving.value = false
  }
}

/** Discards local edits and continues from the row someone else saved. */
function loadLatest() {
  if (!conflict.value) return
  forgetDraft()
  entity.value = conflict.value
  reset(props.resource.toForm(conflict.value))
}

/** Saves these edits over the newer row. */
function overwrite() {
  if (!conflict.value) return
  const revision = conflict.value.revision
  conflict.value = null
  comparing.value = false
  save(revision)
}

/** The fields where my form and the saved row differ, as the diff view shows them. */
const conflictRows = computed(() => {
  if (!conflict.value) return []
  const saved = props.resource.toForm(conflict.value) as Record<string, unknown>
  const mine = state.value as Record<string, unknown>
  return Object.keys(mine)
    .filter(key => JSON.stringify(mine[key] ?? null) !== JSON.stringify(saved[key] ?? null))
    .flatMap(key => expandHistoryChange(historyFieldMeta(props.resource.kind, key), { field: key, before: saved[key], after: mine[key] }))
})

function discardChanges() {
  forgetDraft()
  reset(JSON.parse(baseline.value) as F)
}

/**
 * Closing with changes asks first (21-admin-screens.md "Unsaved changes"). Returns whether the editor may close now; after
 * "Spremi skicu i izađi" it returns false and `exit` runs once the draft is saved.
 */
async function mayLeave(exit: () => unknown) {
  if (saving.value) return false
  if (!dirty.value) return true
  const choice = await chooseUnsaved({ fields: Math.max(1, changedFields.value.length), canSaveDraft: !readOnly.value && (!entity.value || status.value === 'draft') })
  if (choice === 'stay') return false
  if (choice === 'save') {
    nextStatus.value = 'draft'
    addAnother.value = false
    pendingExit = exit
    form.value?.submit()
    return false
  }
  forgetDraft()
  reset(JSON.parse(baseline.value) as F)
  return true
}

function close() {
  open.value = false
}
async function requestClose() {
  if (await mayLeave(close)) close()
}

// The page editor also guards navigation to other screens and closing the tab.
/** Goes where a held-back navigation was going without adding a history entry: back, when it was the entry before. */
function goTo(to: RouteLocationNormalized) {
  return window.history.state?.back === to.fullPath ? router.back() : router.replace(to.fullPath)
}
if (isPage.value) {
  onBeforeRouteLeave(to => mayLeave(() => goTo(to)))
  // Going back to the list (or to another record) in the same page asks too.
  onBeforeRouteUpdate((to, from) => to.query.uredi === from.query.uredi && to.query.novo === from.query.novo ? true : mayLeave(() => goTo(to)))
  onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
}
function onBeforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) event.preventDefault()
}

const primaryAction = computed(() => {
  if (!entity.value || status.value === 'draft') return { label: 'Objavi', status: 'published' as const }
  return { label: isPage.value ? 'Objavi izmjene' : 'Spremi', status: status.value }
})

defineShortcuts({
  meta_s: {
    usingInput: true,
    handler: () => {
      if (open.value && !saving.value && !loading.value && !readOnly.value) requestSave(isPage.value && (!entity.value || status.value === 'draft') ? 'draft' : primaryAction.value.status)
    }
  },
  meta_enter: {
    usingInput: true,
    handler: () => {
      if (open.value && !saving.value && !loading.value && !readOnly.value && (dirty.value || !entity.value || status.value === 'draft')) requestSave(primaryAction.value.status)
    }
  }
})

// The save bar
const saveBarState = computed<SaveBarState>(() => {
  if (saving.value) return 'saving'
  if (conflict.value) return 'conflict'
  if (saveFailed.value) return 'failed'
  if (errorCount.value > 0) return 'errors'
  if (readOnly.value) return 'archived'
  if (dirty.value) return 'unsaved'
  if (justSaved.value) return 'just-saved'
  return entity.value ? 'saved' : 'new'
})
const busyLabel = computed(() => nextStatus.value === 'published' ? 'Objavljujem…' : 'Spremam…')
const saveBarActions = computed<SaveBarAction[]>(() => {
  if (readOnly.value) return [{ key: 'restore', label: 'Vrati u skice', variant: 'primary', busy: restoring.value }]
  const busy = saving.value
  const actions: SaveBarAction[] = []
  if (entity.value) actions.push({ key: 'discard', label: 'Odbaci', variant: 'ghost', disabled: !dirty.value || busy })
  else actions.push({ key: 'another', label: 'Spremi i dodaj novo', variant: 'ghost', disabled: loading.value || busy })
  if (!entity.value || status.value === 'draft') actions.push({ key: 'draft', label: 'Spremi skicu', variant: 'secondary', disabled: loading.value || busy || !!conflict.value })
  actions.push({
    key: 'primary',
    label: primaryAction.value.label,
    variant: 'primary',
    busy,
    disabled: loading.value || (isEdit.value && !entity.value) || (!!entity.value && status.value === 'published' && !dirty.value) || !!conflict.value
  })
  return actions
})

const restoring = ref(false)
async function restoreToDraft() {
  if (!entity.value) return
  restoring.value = true
  try {
    const result = await api.update(entity.value.id, { status: 'draft', revision: entity.value.revision })
    toast.add({ title: 'Vraćeno u skice', description: props.resource.label(result.entity), color: 'success', icon: 'i-lucide-archive-restore' })
    emit('saved', result.entity)
    entity.value = result.entity
    reset(props.resource.toForm(result.entity))
  } catch (error) {
    const problem = adminApiError(error)
    if (problem.statusCode !== 401) toast.add({ title: 'Vraćanje nije uspjelo', description: problem.message, color: 'error' })
  } finally {
    restoring.value = false
  }
}

function onBarAction(key: string) {
  if (key === 'discard') discardChanges()
  else if (key === 'draft') requestSave('draft')
  else if (key === 'another') requestSave('published', true)
  else if (key === 'primary') requestSave(primaryAction.value.status)
  else if (key === 'restore') restoreToDraft()
}

// Errors at the top, each a link to its field.
const fieldIssues = computed(() => ((form.value?.errors ?? []) as FormError[]).filter(error => error.name))
const errorSummaryTitle = computed(() => `Zapis nije ${nextStatus.value === 'published' ? 'objavljen' : 'spremljen'}. Treba ispraviti ${errorCount.value} ${nounFor(errorCount.value, ['polje', 'polja', 'polja'])}.`)
function focusField(name: string) {
  const element = document.getElementById(formId)?.querySelector<HTMLElement>(`[name="${name}"], #${CSS.escape(name)}`)
  element?.focus()
}

// More actions in the editor's header.
const locked = computed(() => entity.value ? props.resource.lockedReason?.(entity.value) : undefined)
const publicPath = computed(() => entity.value?.status === 'published' ? props.resource.publicPath?.(entity.value) : undefined)
async function archiveRecord() {
  if (!entity.value) return
  if (!await confirm({
    title: `Arhivirati „${props.resource.label(entity.value)}”?`,
    description: 'Zapis se više neće prikazivati javno. Poveznice i povijest ostaju, a možeš ga vratiti u skice.',
    confirmLabel: 'Arhiviraj'
  })) return
  try {
    const result = await api.archive(entity.value.id)
    toast.add({ title: 'Arhivirano', description: props.resource.label(result.entity), color: 'success', icon: 'i-lucide-archive' })
    emit('saved', result.entity)
    entity.value = result.entity
    reset(props.resource.toForm(result.entity))
  } catch (error) {
    const problem = adminApiError(error)
    if (problem.statusCode !== 401) toast.add({ title: 'Arhiviranje nije uspjelo', description: problem.message, color: 'error' })
  }
}
const moreItems = computed(() => {
  const lock = locked.value ? { disabled: true, description: locked.value } : {}
  return [[
    ...(status.value === 'archived' ? [] : [{ label: 'Arhiviraj', icon: 'i-lucide-archive', onSelect: archiveRecord, ...lock }]),
    { label: 'Izbriši zapis', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => { deleteOpen.value = true }, ...lock }
  ]]
})
function onDeleted() {
  forgetDraft()
  if (entity.value) emit('saved', entity.value)
  baseline.value = JSON.stringify(state.value)
  open.value = false
}

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
const EditorPage = resolveComponent('AdminEditorPage')
const Modal = resolveComponent('UModal')
const Frame = computed(() => isPage.value ? EditorPage : Modal)
const frameProps = computed(() => isPage.value
  ? { title: entity.value ? props.resource.label(entity.value) : props.resource.labels.create, backLabel: props.resource.labels.title, onBack: requestClose }
  : {
      'open': open.value,
      'onUpdate:open': (value: boolean) => { open.value = value },
      'title': title.value,
      'description': entity.value ? props.resource.label(entity.value) : props.resource.labels.description,
      'dismissible': false,
      'close': false,
      'ui': { content: props.resource.dialogWidth === 'wide' ? 'sm:max-w-4xl' : 'sm:max-w-2xl', footer: 'flex-wrap justify-end' },
      'data-test': 'admin-entity-dialog',
      'onClose:prevent': requestClose
    })
</script>

<template>
  <component
    :is="Frame"
    v-if="isPage ? open : true"
    v-bind="frameProps"
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

    <template #header-actions>
      <UButton
        v-if="entity"
        label="Povijest izmjena"
        icon="i-lucide-history"
        color="neutral"
        variant="outline"
        data-testid="admin-editor-history"
        @click="historyOpen = true"
      />
      <UButton
        v-if="publicPath"
        :to="publicPath"
        target="_blank"
        label="Pogledaj na stranici"
        icon="i-lucide-external-link"
        color="neutral"
        variant="outline"
      />
      <UDropdownMenu
        v-if="entity"
        :items="moreItems"
        :content="{ align: 'end' }"
      >
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="outline"
          aria-label="Više radnji"
        />
      </UDropdownMenu>
    </template>

    <template #body>
      <div
        v-if="loading"
        class="flex flex-col gap-3"
        aria-busy="true"
      >
        <p
          class="sr-only"
          role="status"
        >
          Učitavanje zapisa…
        </p>
        <USkeleton class="h-8 w-full" />
        <USkeleton class="h-8 w-2/3" />
        <USkeleton class="h-20 w-full" />
      </div>
      <UAlert
        v-else-if="loadFailed"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Zapis nismo uspjeli učitati"
        :description="failure || 'Provjeri vezu i pokušaj ponovno. Ako je zapis izbrisan, vrati se na popis.'"
        :actions="[{ label: 'Pokušaj ponovno', color: 'neutral', variant: 'outline', onClick: load }]"
        role="alert"
        data-testid="admin-load-error"
      />
      <UForm
        v-else
        :id="formId"
        ref="form"
        :state="state"
        :validate="validate"
        :validate-on="['blur', 'change']"
        :disabled="saving || readOnly"
        class="flex flex-col gap-4"
        @submit="save()"
        @error="onFormError"
      >
        <UAlert
          v-if="readOnly"
          color="neutral"
          variant="subtle"
          icon="i-lucide-archive"
          title="Ovaj je zapis arhiviran"
          :description="`Ne vidi se na stranici i ne može se uređivati.${entity ? ` Arhivirano ${longDate(entity.updatedAt)}.` : ''}`"
          role="status"
          data-testid="admin-archived-notice"
        />
        <UAlert
          v-if="restoredAt"
          color="neutral"
          variant="subtle"
          icon="i-lucide-history"
          :title="`Vraćene su nespremljene izmjene od ${clockTime(restoredAt)}.`"
          :actions="[{ label: 'Odbaci', color: 'neutral', variant: 'outline', onClick: discardRestored }]"
          role="status"
          data-testid="admin-restored-draft"
        />
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
          :title="`Zapis je spremljen ${agoPhrase(conflict.updatedAt)}`"
          description="Tvoje izmjene nisu spremljene da ne bi prepisale tuđe. Usporedi inačice pa odluči."
          :actions="[
            { label: 'Pregledaj razlike', color: 'neutral', variant: 'outline', onClick: () => { comparing = !comparing } },
            { label: 'Učitaj spremljenu inačicu', color: 'neutral', variant: 'outline', onClick: loadLatest },
            { label: 'Spremi moju svejedno', color: 'warning', onClick: overwrite }
          ]"
          role="alert"
          data-test="admin-conflict"
        >
          <template
            v-if="comparing"
            #description
          >
            <p class="mb-3">
              Tvoje izmjene nisu spremljene da ne bi prepisale tuđe. Usporedi inačice pa odluči.
            </p>
            <AdminDiffView
              :rows="conflictRows"
              old-tag="Spremljeno"
              new-tag="Moja inačica"
            />
          </template>
        </UAlert>
        <UAlert
          v-if="failure && !loadFailed && !errorCount"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="saveFailed ? 'Nije spremljeno. Izmjene su sačuvane u pregledniku.' : failure"
          :description="saveFailed ? failure : (formIssues.join(' ') || undefined)"
          :actions="saveFailed ? [{ label: 'Pokušaj ponovno', color: 'neutral', variant: 'outline', onClick: () => requestSave(nextStatus, addAnother) }] : undefined"
          role="alert"
        />
        <UAlert
          v-if="errorCount > 0"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="errorSummaryTitle"
          role="alert"
          data-testid="admin-error-summary"
        >
          <template #description>
            <ul class="list-disc ps-5">
              <li
                v-for="issue in fieldIssues"
                :key="`${issue.name}-${issue.message}`"
              >
                <button
                  type="button"
                  class="text-start underline underline-offset-2"
                  @click="focusField(issue.name!)"
                >
                  {{ issue.message }}
                </button>
              </li>
              <li
                v-for="message in formIssues"
                :key="message"
              >
                {{ message }}
              </li>
            </ul>
          </template>
        </UAlert>

        <slot
          name="fields"
          :state="state"
          :entity="entity"
        />

        <UCollapsible
          v-if="!isPage && (entity || $slots.advanced)"
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

    <template #side>
      <section
        class="flex flex-col gap-3 rounded-lg border border-default bg-default p-4"
        aria-labelledby="admin-side-publish"
      >
        <h3
          id="admin-side-publish"
          class="pz-h3 text-highlighted"
        >
          Objava
        </h3>
        <PzStatusBadge
          :status="status"
          :unpublished-changes="false"
        />
        <p
          v-if="!entity"
          class="text-sm text-muted"
        >
          Skica se ne vidi na stranici dok je ne objaviš.
        </p>
        <p
          v-else
          class="text-sm text-muted"
        >
          {{ status === 'published' ? 'Objavljeno' : status === 'archived' ? 'Arhivirano' : 'Skica spremljena' }} {{ longDate(entity.updatedAt) }} · revizija {{ entity.revision }}
        </p>
      </section>
      <slot
        name="side"
        :state="state"
        :entity="entity"
      />
      <UCollapsible
        v-if="entity"
        class="rounded-lg border border-default bg-default"
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
            <dl class="grid gap-x-4 gap-y-2 text-sm">
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
                Izmijenjeno
              </dt>
              <dd>{{ formatDate(entity.updatedAt) }}</dd>
            </dl>
          </div>
        </template>
      </UCollapsible>
    </template>

    <template #footer>
      <AdminSaveBar
        v-if="isPage"
        :status="entity?.status"
        :state="saveBarState"
        :count="saveBarState === 'errors' ? errorCount : changedFields.length"
        :busy-label="busyLabel"
        :actions="saveBarActions"
        @action="onBarAction"
      />
      <template v-else>
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
    </template>
  </component>

  <template v-if="isPage && open && entity">
    <AdminHistoryDrawer
      v-model:open="historyOpen"
      :kind="resource.kind"
      :entity-id="entity.id"
      @restored="load()"
    />
    <AdminDeleteDialog
      v-model:open="deleteOpen"
      :resource="resource"
      :entity="entity"
      @done="onDeleted"
    />
  </template>
</template>
