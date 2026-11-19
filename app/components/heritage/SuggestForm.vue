<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import type { ContributionField, ContributionKind, ContributionMode } from '~~/shared/utils/contribution'
import { CONTRIBUTION_KIND_LABELS, contributionFields } from '~~/shared/utils/contribution'
import { buildSuggestPayload, SOURCE_TYPE_LABELS, suggestSummary } from '~~/shared/utils/suggest'
import { SUBMISSION_LIMITS, validateSubmission } from '~~/shared/utils/submission'
import type { SubmissionIssue } from '~~/shared/utils/submission'
import type { SuggestOptionsResponse } from '~~/shared/types/publicAtlas'
import { CONTRIBUTION_DRAFT_STORAGE_KEY } from '~~/app/utils/contributionDraft'

// The body of every suggestion: a correction of one row, or a proposal for a new one. Used in the dialog
// (HeritageSuggestDialog) and in place on /doprinesi. Only the whitelisted fields of the kind are shown;
// a correction sends just what the visitor changed.
const props = defineProps<{
  kind: ContributionKind
  mode: ContributionMode
  /** What a correction is about: the row's id (UUID or old id), a label for the heading and, when known, its revision. */
  target?: { id: string, label: string, revision?: number }
  /** The row's current values by payload field; a correction starts from them and sends only the differences. `categoryKey` fills `categoryId` once the options are in. */
  current?: Record<string, string | undefined>
  /** Values a proposal starts with (e.g. the settlement the visitor came from). */
  prefill?: Record<string, string | undefined>
  /** Shows a cancel button and emits `close` instead of offering "send another". */
  dialog?: boolean
  /** Enables device draft persistence for the public contribution page. */
  draftKey?: string
}>()
const emit = defineEmits<{ close: [] }>()
const formId = useId()

const { t } = useI18n()
const { locale, toFormErrors, submit } = useSubmissionRequest()

const fields = computed(() => contributionFields(props.kind, props.mode))
const { data: options } = useLazyFetch<SuggestOptionsResponse>('/api/content/suggest-options', { key: 'suggest-options' })

const currentValues = computed(() => {
  const values = { ...props.current }
  const key = values.categoryKey
  if (key && !values.categoryId) {
    const id = options.value?.categories.find(category => category.key === key)?.id
    if (id) values.categoryId = id
  }
  return values
})

function startValues() {
  return { ...(props.mode === 'correction' ? currentValues.value : props.prefill) }
}
const values = reactive<Record<string, string | undefined>>(startValues())
const state = reactive({ note: '', name: '', contact: '', consentPublish: false, website: '' })
const placeQuery = ref('')
const form = useTemplateRef('form')
const root = useTemplateRef<HTMLElement>('root')
const closeButton = useTemplateRef<{ $el: HTMLElement }>('closeButton')
const success = useTemplateRef<{ focus: () => void }>('success')
const sendState = ref<'idle' | 'sending' | 'sent' | 'error'>('idle')
const sendError = ref('')
const formToken = ref<string | null>(null)
const draftRestored = ref(false)
const draftStorageKey = computed(() => props.draftKey ? `${CONTRIBUTION_DRAFT_STORAGE_KEY}/${props.draftKey}` : null)

function readDraft() {
  if (!import.meta.client || !draftStorageKey.value) return
  try {
    const raw = window.localStorage.getItem(draftStorageKey.value)
    if (!raw) return
    const draft = JSON.parse(raw) as { values?: Record<string, string | undefined>, state?: Partial<typeof state>, placeQuery?: string }
    if (draft.values && typeof draft.values === 'object') Object.assign(values, draft.values)
    if (draft.state && typeof draft.state === 'object') {
      const { note, name, contact } = draft.state
      Object.assign(state, {
        note: typeof note === 'string' ? note : state.note,
        name: typeof name === 'string' ? name : state.name,
        contact: typeof contact === 'string' ? contact : state.contact
      })
    }
    if (typeof draft.placeQuery === 'string') placeQuery.value = draft.placeQuery
    draftRestored.value = true
  } catch {
    // Ignore malformed or unavailable device storage.
  }
}

function saveDraft() {
  if (!import.meta.client || !draftStorageKey.value || sendState.value === 'sent') return
  const base = startValues()
  const changed: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(values)) if (value !== base[key] && (value || base[key])) changed[key] = value
  if (!Object.keys(changed).length && !state.note && !state.name && !state.contact && !placeQuery.value) {
    clearDraft()
    return
  }
  try {
    window.localStorage.setItem(draftStorageKey.value, JSON.stringify({ values: changed, state: { note: state.note, name: state.name, contact: state.contact }, placeQuery: placeQuery.value }))
  } catch {
    // Ignore private browsing and full storage.
  }
}

function clearDraft() {
  if (!import.meta.client || !draftStorageKey.value) return
  try {
    window.localStorage.removeItem(draftStorageKey.value)
  } catch {
    // Ignore storage failures after a successful send.
  }
}

// The category id of the current item is known only once the options arrive; fill what the visitor has not touched.
watch(currentValues, (next) => {
  if (props.mode !== 'correction') return
  for (const [key, value] of Object.entries(next)) if (values[key] === undefined) values[key] = value
})

// A signed render-time token: the server ignores forms filled in faster than a person could.
onMounted(async () => {
  readDraft()
  try {
    formToken.value = (await $fetch<{ token: string | null }>('/api/submission-token')).token
  } catch {
    formToken.value = null
  }
})
watch(values, saveDraft, { deep: true })
watch(state, saveDraft, { deep: true })
watch(placeQuery, saveDraft)

const heading = computed(() => props.mode === 'correction'
  ? t('heritage.suggest.correctionOf', { name: props.target?.label ?? '' })
  : t(`heritage.suggest.newKind.${props.kind}`))

const categoryItems = computed(() => (options.value?.categories ?? []).map(category => ({ label: category.label, value: category.id })))
const municipalityItems = computed(() => (options.value?.municipalities ?? []).map(municipality => ({ label: municipality.label, value: municipality.id })))
const municipalityLabel = computed(() => new Map((options.value?.municipalities ?? []).map(municipality => [municipality.id, municipality.label])))
const settlementItems = computed(() => (options.value?.settlements ?? []).map(settlement => ({
  label: `${settlement.name} (${municipalityLabel.value.get(settlement.municipalityId) ?? ''})`,
  value: settlement.id
})))
const sourceTypeItems = Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => ({ label, value }))

type Widget = 'select' | 'settlement' | 'place' | 'sourceType' | 'long' | 'url' | 'text'
function widget(field: ContributionField): Widget {
  if (field.key === 'categoryId' || field.key === 'municipalityId' || field.key === 'parentId') return 'select'
  if (field.key === 'settlementId') return 'settlement'
  if (field.type === 'geonames') return 'place'
  if (field.type === 'sourceType') return 'sourceType'
  return field.type === 'long' ? 'long' : field.type === 'url' ? 'url' : 'text'
}
function selectItems(key: string) {
  return key === 'categoryId' ? categoryItems.value : municipalityItems.value
}

function payload() {
  return buildSuggestPayload(props.kind, props.mode, values, currentValues.value)
}
function body() {
  const summary = suggestSummary(props.mode, props.target?.label ?? payloadLabel())
  return {
    text: state.note.trim() || summary,
    type: props.mode,
    targetKind: props.kind,
    ...(props.mode === 'correction' ? { targetId: props.target?.id, baseRevision: props.target?.revision } : {}),
    payload: payload(),
    name: state.name,
    contact: state.contact,
    consentPublish: state.consentPublish,
    website: state.website,
    locale: locale.value
  }
}
// The name a proposal is about, for the one-line summary when no note was written.
function payloadLabel() {
  return values.name ?? values.headword ?? values.title ?? t(`heritage.suggest.newKind.${props.kind}`)
}

const issueText = (issue: SubmissionIssue) => {
  if (issue.field === 'payload') {
    if (issue.code === 'required') return t('heritage.suggest.errors.required')
    if (issue.code === 'tooLong') return t('heritage.form.errors.tooLong', { max: contributionFields(props.kind, props.mode).find(field => field.key === issue.path)?.max ?? '' })
    if (issue.code === 'links') return t('heritage.suggest.errors.links')
    return t('heritage.suggest.errors.invalid')
  }
  return toFormErrors([issue])[0]!.message
}
function toErrors(issues: SubmissionIssue[]): FormError[] {
  return issues.map((issue) => {
    if (issue.field === 'payload') {
      // A correction that changes nothing is an issue of the payload as a whole.
      return { name: issue.path ? `p.${issue.path}` : 'note', message: issue.path ? issueText(issue) : t(issue.code === 'links' ? 'heritage.suggest.errors.links' : 'heritage.suggest.errors.nothingChanged') }
    }
    return { name: issue.field === 'text' ? 'note' : issue.field, message: issueText(issue) }
  })
}

function validate(): FormError[] {
  const result = validateSubmission(body())
  return result.ok ? [] : toErrors(result.issues)
}

async function send() {
  if (sendState.value === 'sending') return
  sendState.value = 'sending'
  const outcome = await submit({ ...body(), formToken: formToken.value })
  if (outcome.ok) {
    clearDraft()
    draftRestored.value = false
    sendState.value = 'sent'
    await nextTick()
    closeButton.value?.$el?.focus()
    success.value?.focus()
    return
  }
  if (outcome.issues) form.value?.setErrors(toErrors(outcome.issues))
  sendError.value = outcome.message
  sendState.value = 'error'
}

function reset() {
  const fresh = startValues()
  for (const key of Object.keys(values)) values[key] = fresh[key]
  Object.assign(values, fresh)
  Object.assign(state, { note: '', consentPublish: false })
  placeQuery.value = ''
  clearDraft()
  draftRestored.value = false
  sendState.value = 'idle'
}

defineExpose({
  focusFirst: () => root.value?.querySelector<HTMLElement>('input:not([type=hidden]):not([type=checkbox]), textarea, [role=combobox], button[role=combobox]')?.focus()
})
</script>

<template>
  <div
    ref="root"
    class="flex flex-col gap-4"
    data-testid="suggest-form"
  >
    <UAlert
      v-if="draftRestored"
      title="Vraćen je nedovršeni prilog."
      description="Nastavi gdje si stao ili ga obriši."
      icon="i-lucide-rotate-ccw"
      color="neutral"
      role="status"
      :actions="[{ label: 'Obriši', color: 'neutral', variant: 'ghost', onClick: () => { clearDraft(); draftRestored = false } }]"
    />
    <div
      class="rounded-lg bg-elevated px-3 py-2"
      data-testid="suggest-heading"
    >
      <p class="text-xs text-muted">
        {{ t(`heritage.suggest.mode.${mode}`) }} · {{ CONTRIBUTION_KIND_LABELS[kind] }}
      </p>
      <p class="text-lg font-bold wrap-anywhere text-highlighted">
        {{ heading }}
      </p>
    </div>

    <PzSubmissionSuccess
      v-if="sendState === 'sent' && !dialog"
      ref="success"
      @again="reset"
    />
    <div
      v-else-if="sendState === 'sent'"
      class="flex flex-col items-start gap-3"
    >
      <UAlert
        :title="t('heritage.form.successTitle')"
        :description="t('heritage.suggest.successDescription')"
        icon="i-lucide-circle-check"
        color="success"
        variant="subtle"
        role="status"
        class="w-full"
      />
      <UButton
        ref="closeButton"
        :label="t('heritage.form.close')"
        color="neutral"
        variant="subtle"
        @click="emit('close')"
      />
    </div>

    <UForm
      v-else
      :id="formId"
      ref="form"
      :state="state"
      :validate="validate"
      novalidate
      class="flex flex-col gap-4"
      @submit="send"
    >
      <p
        v-if="mode === 'correction'"
        class="text-sm text-muted"
      >
        {{ t('heritage.suggest.correctionHelp') }}
      </p>

      <UFormField
        v-for="field in fields"
        :key="field.key"
        :name="`p.${field.key}`"
        :label="field.label"
        :required="field.required"
      >
        <USelect
          v-if="widget(field) === 'select'"
          v-model="values[field.key]"
          :items="selectItems(field.key)"
          :placeholder="t('heritage.suggest.choose')"
          :loading="!options"
          class="w-full"
        />
        <USelectMenu
          v-else-if="widget(field) === 'settlement'"
          v-model="values[field.key]"
          :items="settlementItems"
          value-key="value"
          :placeholder="t('heritage.suggest.choose')"
          :search-input="{ placeholder: t('heritage.suggest.search') }"
          :loading="!options"
          class="w-full"
        />
        <USelect
          v-else-if="widget(field) === 'sourceType'"
          v-model="values[field.key]"
          :items="sourceTypeItems"
          :placeholder="t('heritage.suggest.choose')"
          class="w-full"
        />
        <HeritagePlacePicker
          v-else-if="widget(field) === 'place'"
          v-model:query="placeQuery"
          :model-value="values[field.key] ?? null"
          :required="field.required"
          @update:model-value="values[field.key] = $event ?? undefined"
        />
        <UTextarea
          v-else-if="widget(field) === 'long'"
          v-model="values[field.key]"
          :rows="3"
          :maxrows="8"
          autoresize
          :maxlength="field.max"
          lang="hr"
          class="w-full"
        />
        <UInput
          v-else
          v-model="values[field.key]"
          :type="widget(field) === 'url' ? 'url' : 'text'"
          :maxlength="field.max"
          lang="hr"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="note"
        :label="t('heritage.suggest.note')"
        :help="t('heritage.suggest.noteHelp')"
      >
        <UTextarea
          v-model="state.note"
          :rows="2"
          :maxrows="6"
          autoresize
          :maxlength="SUBMISSION_LIMITS.text.max"
          lang="hr"
          class="w-full"
        />
      </UFormField>

      <HeritageSubmissionContributorFields
        v-model:name="state.name"
        v-model:contact="state.contact"
        v-model:consent-publish="state.consentPublish"
        v-model:website="state.website"
        :privacy-in-new-tab="dialog"
      />

      <UAlert
        v-if="sendState === 'error'"
        :title="t('heritage.form.errorTitle')"
        :description="sendError"
        icon="i-lucide-circle-alert"
        color="error"
        variant="subtle"
        role="alert"
      />

      <div
        class="flex flex-wrap justify-end gap-2"
        :class="dialog ? 'sticky bottom-0 bg-elevated pt-3' : 'max-lg:hidden'"
      >
        <UButton
          v-if="dialog"
          :label="t('heritage.variantDialog.cancel')"
          color="neutral"
          variant="ghost"
          @click="emit('close')"
        />
        <UButton
          type="submit"
          :label="t('heritage.form.submit')"
          trailing-icon="i-lucide-send"
          :loading="sendState === 'sending'"
          size="lg"
        />
      </div>
    </UForm>

    <PzStickyActionBar v-if="!dialog && sendState !== 'sent'">
      <UButton
        type="submit"
        :form="formId"
        :label="t('heritage.form.submit')"
        trailing-icon="i-lucide-send"
        :loading="sendState === 'sending'"
        size="lg"
        data-testid="contribute-submit-mobile"
      />
    </PzStickyActionBar>
  </div>
</template>
