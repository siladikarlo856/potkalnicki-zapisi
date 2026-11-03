<script setup lang="ts">
import type { FormError, SelectItem } from '@nuxt/ui'
import { SUBMISSION_LIMITS, SUBMISSION_TYPES, validateSubmission } from '~~/shared/utils/submission'
import type { SubmissionIntent, SubmissionType } from '~~/shared/utils/submission'

const props = defineProps<{
  /** Headword to prefill "Instead of … we say:", e.g. the word a visitor came here about. */
  word?: string
  fixedType?: SubmissionType
  hideTypePicker?: boolean
  /** Word this contribution concerns (from the daily word). Sent with `intent` so editors see the link. */
  wordId?: string
  /** `usage` = "this word is said in my place too": the place becomes required. `variant` = a local form. */
  intent?: SubmissionIntent
}>()

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

function validate(): FormError[] {
  const result = validateSubmission({ ...state, wordId: props.wordId, intent: props.wordId ? props.intent : undefined, locale: locale.value })
  const errors = result.ok ? [] : toFormErrors(result.issues)
  if (placeQuery.value.trim() && !state.placeId) errors.push({ name: 'place', message: t('heritage.places.choose') })
  return errors
}

async function send() {
  sendState.value = 'idle'
  const outcome = await submit({
    ...state,
    type: props.fixedType ?? state.type ?? null,
    ...(props.wordId ? { wordId: props.wordId, intent: props.intent } : {})
  })
  if (outcome.ok) {
    Object.assign(state, { text: '', type: undefined, placeId: null, name: '', contact: '', consentPublish: false })
    placeQuery.value = ''
    sendState.value = 'sent'
    return
  }
  if (outcome.issues) form.value?.setErrors(toFormErrors(outcome.issues))
  sendError.value = outcome.message
  sendState.value = 'error'
}

function sendAnother() {
  sendState.value = 'idle'
}
const successActions = computed(() => [
  { label: t('heritage.form.sendAnother'), color: 'neutral' as const, variant: 'subtle' as const, onClick: sendAnother }
])
</script>

<template>
  <div class="flex flex-col gap-4">
    <UAlert
      v-if="sendState === 'sent'"
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
      ref="form"
      :state="state"
      :validate="validate"
      novalidate
      class="flex flex-col gap-4 rounded-lg bg-default p-4 ring ring-default sm:p-6"
      @submit="send"
    >
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
        :title="t('heritage.form.errorTitle')"
        :description="sendError"
        icon="i-lucide-circle-alert"
        color="error"
        variant="subtle"
        role="alert"
      />

      <div class="flex flex-wrap justify-end gap-2 print:hidden">
        <UButton
          type="submit"
          :label="t('heritage.form.submit')"
          trailing-icon="i-lucide-send"
          size="lg"
        />
      </div>
    </UForm>
  </div>
</template>
