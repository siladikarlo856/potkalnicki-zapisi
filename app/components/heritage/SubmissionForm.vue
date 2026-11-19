<script setup lang="ts">
import type { FormError, SelectItem } from '@nuxt/ui'
import { SUBMISSION_LIMITS, SUBMISSION_TYPES, validateSubmission } from '~~/shared/utils/submission'
import type { SubmissionIntent, SubmissionType } from '~~/shared/utils/submission'
import { CONTRIBUTION_DRAFT_STORAGE_KEY, type ContributionDraft } from '~~/app/utils/contributionDraft'

const props = defineProps<{
  /** Headword to prefill "Instead of … we say:", e.g. the word a visitor came here about. */
  word?: string
  fixedType?: SubmissionType
  hideTypePicker?: boolean
  /** Word this contribution concerns (from the daily word). Sent with `intent` so editors see the link. */
  wordId?: string
  /** `usage` = "this word is said in my place too": the place becomes required. `variant` = a local form. */
  intent?: SubmissionIntent
  /** Prefill the place field (learn “Moje mjesto”). Resolved through `/api/places` on the client. */
  presetPlace?: { name: string, query?: string }
  /** On /doprinesi: Pošalji sits in the sticky action bar on a phone, and the success state offers links back into the archive. */
  stickyBar?: boolean
  /** Enables the device draft for the public contribute page. */
  draftKey?: string
}>()
const formId = useId()

const { t } = useI18n()
const { locale, toFormErrors, submit } = useSubmissionRequest()

const typeItems = computed<SelectItem[]>(() => SUBMISSION_TYPES
  .map(type => ({ label: t(`heritage.form.types.${type}`), value: type })))

const state = reactive({
  text: '',
  type: undefined as SubmissionType | undefined,
  placeId: null as string | null,
  name: '',
  contact: '',
  consentPublish: false,
  website: ''
})

const typeSelect = useTemplateRef<{ triggerRef: HTMLElement | null }>('typeSelect')
function clearType() {
  state.type = undefined
  typeSelect.value?.triggerRef?.focus()
}

const usage = computed(() => props.wordId && props.intent === 'usage')
const placeQuery = ref('')
const form = useTemplateRef('form')
const textarea = useTemplateRef<{ textareaRef: HTMLTextAreaElement | null }>('textarea')
const sendState = ref<'idle' | 'sent' | 'error'>('idle')
const sendError = ref('')
const errorKind = ref<'network' | 'rate-limit' | 'invalid' | null>(null)
const validationErrors = ref<FormError[]>([])
const draftRestored = ref(false)
const online = ref(true)
const summary = useTemplateRef<HTMLElement>('summary')
const draftStorageKey = computed(() => props.draftKey ? `${CONTRIBUTION_DRAFT_STORAGE_KEY}/${props.draftKey}` : null)

function readDraft() {
  if (!import.meta.client || !draftStorageKey.value) return
  try {
    const raw = window.localStorage.getItem(draftStorageKey.value)
    if (!raw) return
    const draft = JSON.parse(raw) as Partial<ContributionDraft>
    if (typeof draft.text !== 'string' && typeof draft.name !== 'string' && typeof draft.contact !== 'string') return
    Object.assign(state, {
      text: typeof draft.text === 'string' ? draft.text : state.text,
      type: typeof draft.type === 'string' ? draft.type as SubmissionType : state.type,
      placeId: typeof draft.placeId === 'string' ? draft.placeId : state.placeId,
      name: typeof draft.name === 'string' ? draft.name : state.name,
      contact: typeof draft.contact === 'string' ? draft.contact : state.contact,
      consentPublish: draft.consentPublish === true
    })
    if (typeof draft.placeQuery === 'string') placeQuery.value = draft.placeQuery
    draftRestored.value = true
  } catch {
    // A malformed local draft should never prevent a visitor from contributing.
  }
}

function saveDraft() {
  if (!import.meta.client || !draftStorageKey.value || sendState.value === 'sent') return
  if (!state.text && !state.name && !state.contact && !placeQuery.value && !state.type) return
  try {
    const draft: ContributionDraft = { text: state.text, type: state.type, placeId: state.placeId, placeQuery: placeQuery.value, name: state.name, contact: state.contact, consentPublish: state.consentPublish }
    window.localStorage.setItem(draftStorageKey.value, JSON.stringify(draft))
  } catch {
    // Private browsing and full storage should not interrupt typing.
  }
}

function clearDraft() {
  if (!import.meta.client || !draftStorageKey.value) return
  try {
    window.localStorage.removeItem(draftStorageKey.value)
  } catch {
    // Ignore storage failures; the send has already succeeded.
  }
}

function updateOnline() {
  online.value = navigator.onLine
}

onMounted(() => {
  readDraft()
  updateOnline()
  window.addEventListener('online', updateOnline)
  window.addEventListener('offline', updateOnline)
})
onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('online', updateOnline)
    window.removeEventListener('offline', updateOnline)
  }
})
watch(state, saveDraft, { deep: true })
watch(placeQuery, saveDraft)

// A visitor can arrive with a word, so the sentence starts with the variant wording.
// Never overwrite anything the visitor has already typed.
watch(() => props.fixedType, (type) => {
  if (type) state.type = type
}, { immediate: true })

watch(() => props.word, (word) => {
  if (!word || state.text) return
  state.text = t(usage.value ? 'heritage.form.usagePrefill' : 'heritage.form.prefill', { word })
  state.type = 'word'
  nextTick(() => {
    const element = textarea.value?.textareaRef
    element?.setSelectionRange(state.text.length, state.text.length)
  })
}, { immediate: true })

async function applyPresetPlace() {
  const preset = props.presetPlace
  if (!preset || !usage.value) return
  placeQuery.value = preset.query ?? preset.name
  try {
    const response = await $fetch<{ places: { id: string, name: string }[] }>('/api/places', {
      query: { q: preset.name },
      retry: 0
    })
    const match = response.places.find(p => p.name === preset.name)
    if (match) state.placeId = match.id
  } catch {
    // visitor can still pick the place manually
  }
}

watch(() => props.presetPlace, () => {
  void applyPresetPlace()
}, { immediate: true })

function validate(): FormError[] {
  const result = validateSubmission({ ...state, wordId: props.wordId, intent: props.wordId ? props.intent : undefined, locale: locale.value })
  const errors = result.ok ? [] : toFormErrors(result.issues)
  if (placeQuery.value.trim() && !state.placeId) errors.push({ name: 'place', message: t('heritage.places.choose') })
  validationErrors.value = errors
  if (errors.length) nextTick(() => summary.value?.focus())
  return errors
}

async function send() {
  sendState.value = 'idle'
  errorKind.value = null
  if (!online.value) {
    sendError.value = 'Upisano se čuva na ovom uređaju. Prilog ćeš moći poslati čim se veza vrati.'
    errorKind.value = 'network'
    sendState.value = 'error'
    return
  }
  const outcome = await submit({
    ...state,
    type: props.fixedType ?? state.type ?? null,
    ...(props.wordId ? { wordId: props.wordId, intent: props.intent } : {})
  })
  if (outcome.ok) {
    Object.assign(state, { text: '', type: undefined, placeId: null, name: '', contact: '', consentPublish: false })
    placeQuery.value = ''
    clearDraft()
    draftRestored.value = false
    validationErrors.value = []
    sendState.value = 'sent'
    return
  }
  if (outcome.issues) {
    const errors = toFormErrors(outcome.issues)
    form.value?.setErrors(errors)
    validationErrors.value = errors
  }
  sendError.value = outcome.message
  errorKind.value = outcome.kind ?? 'network'
  sendState.value = 'error'
  nextTick(() => summary.value?.focus())
}

function sendAnother() {
  sendState.value = 'idle'
  errorKind.value = null
}
const fieldLabels: Record<string, string> = {
  text: 'Tvoja riječ, izraz ili sjećanje',
  type: 'Što šalješ?',
  place: 'Naselje',
  consentPublish: 'Pristanak za objavu',
  name: 'Ime za potpis',
  contact: 'E-pošta'
}
const errorSummary = computed(() => validationErrors.value.map(error => ({ ...error, label: error.name ? fieldLabels[error.name] ?? error.name : 'Obrazac' })))
const errorTitle = computed(() => errorKind.value === 'rate-limit' ? 'Previše priloga u kratkom vremenu' : errorKind.value === 'network' ? 'Nismo uspjeli poslati prilog' : t('heritage.form.errorTitle'))
const errorDescription = computed(() => errorKind.value === 'network' ? 'Sve što je upisano ostalo je u obrascu i spremljeno je na ovom uređaju. Provjeri vezu i pokušaj ponovno.' : sendError.value)
const submitLabel = computed(() => errorKind.value === 'network' && sendState.value === 'error' ? 'Pokušaj ponovno' : t('heritage.form.submit'))
const successActions = computed(() => [
  { label: t('heritage.form.sendAnother'), color: 'neutral' as const, variant: 'subtle' as const, onClick: sendAnother }
])
</script>

<template>
  <div class="flex flex-col gap-4">
    <UAlert
      v-if="draftRestored"
      title="Vraćen je nedovršeni prilog."
      description="Nastavi gdje si stao ili ga obriši."
      icon="i-lucide-rotate-ccw"
      color="neutral"
      role="status"
      :actions="[{ label: 'Obriši', color: 'neutral', variant: 'ghost', onClick: () => { clearDraft(); draftRestored = false } }]"
    />
    <PzSubmissionSuccess
      v-if="sendState === 'sent' && stickyBar"
      @again="sendAnother"
    />
    <UAlert
      v-else-if="sendState === 'sent'"
      :title="t('heritage.form.successTitle')"
      :description="t('heritage.form.successDescription')"
      icon="i-lucide-circle-check"
      color="success"
      variant="subtle"
      role="status"
      :actions="successActions"
    />

    <UForm
      v-else
      :id="formId"
      ref="form"
      :state="state"
      :validate="validate"
      novalidate
      class="flex flex-col gap-4 rounded-lg bg-default p-4 ring ring-default sm:p-6"
      @submit="send"
    >
      <div
        v-if="errorSummary.length"
        ref="summary"
        tabindex="-1"
        class="rounded-(--pz-radius-md) border border-(--pz-error) bg-(--pz-error-bg) p-3 outline-none"
        role="alert"
        data-testid="contribute-error-summary"
      >
        <p class="font-bold">
          Prilog još nije poslan. Treba dopuniti {{ errorSummary.length }} {{ errorSummary.length === 1 ? 'polje' : 'polja' }}.
        </p>
        <ul class="mt-2 list-disc pl-5 text-sm">
          <li
            v-for="error in errorSummary"
            :key="error.name"
          >
            <a
              :href="`#${formId}-${error.name}`"
              class="underline"
            >{{ error.label }}: {{ error.message }}</a>
          </li>
        </ul>
      </div>
      <UFormField
        name="text"
        :label="t('heritage.form.text')"
        required
      >
        <UTextarea
          ref="textarea"
          v-model="state.text"
          :rows="4"
          :maxrows="12"
          autoresize
          :maxlength="SUBMISSION_LIMITS.text.max"
          :placeholder="t('heritage.form.textPlaceholder')"
          class="w-full"
        />
      </UFormField>

      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField
          v-if="!props.hideTypePicker"
          name="type"
          :label="t('heritage.form.type')"
        >
          <template #hint>
            <UButton
              v-if="state.type"
              :label="t('heritage.form.typeClear')"
              :aria-label="t('heritage.form.typeClearLabel')"
              color="neutral"
              variant="link"
              size="xs"
              class="print:hidden"
              @click="clearType"
            />
          </template>
          <USelect
            ref="typeSelect"
            v-model="state.type"
            :items="typeItems"
            :placeholder="t('heritage.form.typePlaceholder')"
            class="w-full"
          />
        </UFormField>
        <UFormField
          name="place"
          :label="usage ? t('heritage.form.placeUsage') : t('heritage.form.place')"
          :help="t('heritage.places.help')"
          :required="!!usage"
          class="sm:col-span-2"
        >
          <HeritagePlacePicker
            v-model="state.placeId"
            v-model:query="placeQuery"
            @selection="form?.clear('place')"
          />
        </UFormField>
      </div>

      <HeritageSubmissionContributorFields
        v-model:name="state.name"
        v-model:contact="state.contact"
        v-model:consent-publish="state.consentPublish"
        v-model:website="state.website"
      />

      <UAlert
        v-if="sendState === 'error'"
        :title="errorTitle"
        :description="errorDescription"
        icon="i-lucide-circle-alert"
        color="error"
        variant="subtle"
        role="alert"
      />

      <div
        class="flex flex-wrap justify-end gap-2 print:hidden"
        :class="{ 'max-lg:hidden': stickyBar }"
      >
        <UButton
          type="submit"
          :label="submitLabel"
          trailing-icon="i-lucide-send"
          size="lg"
        />
      </div>
    </UForm>

    <PzStickyActionBar v-if="stickyBar && sendState !== 'sent'">
      <UButton
        type="submit"
        :form="formId"
        :label="submitLabel"
        trailing-icon="i-lucide-send"
        size="lg"
        data-testid="contribute-submit-mobile"
      />
    </PzStickyActionBar>
  </div>
</template>
