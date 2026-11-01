<script setup lang="ts">
import type { FormError, SelectItem } from '@nuxt/ui'
import { SUBMISSION_LIMITS, SUBMISSION_TYPES, validateSubmission } from '~~/shared/utils/submission'

const props = defineProps<{
  /** Headword to prefill "Instead of … we say:", e.g. the word on a game card. */
  word?: string
  /** Shows a close button, so the form can be dismissed when it is inline on a page. */
  dismissible?: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const { locale, t } = useI18n()
const localePath = useLocalePath()

const typeItems = computed<SelectItem[]>(() => SUBMISSION_TYPES
  .map(type => ({ label: t(`heritage.form.types.${type}`), value: type })))

const state = reactive({
  text: '',
  type: undefined as SubmissionType | undefined,
  placeId: null as string | null,
  name: '',
  contact: '',
  consentPublish: false,
  // Honeypot, hidden from people: see server/api/submissions.post.ts.
  website: ''
})

const typeSelect = useTemplateRef<{ triggerRef: HTMLElement | null }>('typeSelect')
function clearType() {
  state.type = undefined
  typeSelect.value?.triggerRef?.focus()
}

const placeQuery = ref('')
const form = useTemplateRef('form')
const textarea = useTemplateRef<{ textareaRef: HTMLTextAreaElement | null }>('textarea')
const sendState = ref<'idle' | 'sent' | 'error'>('idle')
const sendError = ref('')

// A card can hand in its word, so the sentence starts with the variant wording.
// Never overwrite anything the visitor has already typed.
watch(() => props.word, (word) => {
  if (!word || state.text) return
  state.text = t('heritage.form.prefill', { word })
  state.type = 'word'
  nextTick(() => {
    const element = textarea.value?.textareaRef
    element?.setSelectionRange(state.text.length, state.text.length)
  })
}, { immediate: true })

function issueMessage({ field, code }: SubmissionIssue) {
  if (field === 'place') return t(`heritage.places.${code === 'refreshPlace' ? 'refresh' : code === 'selectPlace' ? 'choose' : 'invalid'}`)
  if (field === 'consentPublish') return t('heritage.form.errors.consent')
  if (code === 'required') return t('heritage.form.errors.required')
  if (code === 'tooShort') return t('heritage.form.errors.tooShort', { min: SUBMISSION_LIMITS.text.min })
  if (code === 'tooLong') {
    const max = SUBMISSION_LIMITS[field as keyof typeof SUBMISSION_LIMITS]?.max
    return t('heritage.form.errors.tooLong', { max })
  }
  return t('heritage.form.errors.invalid')
}

function toFormErrors(issues: SubmissionIssue[]): FormError[] {
  return issues.map(issue => ({ name: issue.field, message: issueMessage(issue) }))
}

function validate(): FormError[] {
  const result = validateSubmission({ ...state, locale: locale.value })
  const errors = result.ok ? [] : toFormErrors(result.issues)
  if (placeQuery.value.trim() && !state.placeId) errors.push({ name: 'place', message: t('heritage.places.choose') })
  return errors
}

async function send() {
  sendState.value = 'idle'
  try {
    await $fetch('/api/submissions', {
      method: 'POST',
      body: { ...state, locale: locale.value }
    })
    Object.assign(state, { text: '', type: undefined, placeId: null, name: '', contact: '', consentPublish: false })
    placeQuery.value = ''
    sendState.value = 'sent'
  } catch (error) {
    const { statusCode, data } = error as { statusCode?: number, data?: { data?: { issues?: SubmissionIssue[] } } }
    const issues = data?.data?.issues
    if (statusCode === 400 && issues?.length) {
      form.value?.setErrors(toFormErrors(issues))
      sendError.value = t('heritage.form.errorInvalid')
    } else if (statusCode === 429) {
      sendError.value = t('heritage.form.errorTooMany')
    } else {
      sendError.value = t('heritage.form.errorGeneric')
    }
    sendState.value = 'error'
  }
}

function sendAnother() {
  sendState.value = 'idle'
}
function closeForm() {
  emit('close')
}
const successActions = computed(() => {
  const sendAnotherAction = { label: t('heritage.form.sendAnother'), color: 'neutral' as const, variant: 'subtle' as const, onClick: sendAnother }
  const closeAction = { label: t('heritage.form.close'), color: 'neutral' as const, variant: 'subtle' as const, onClick: closeForm }
  return props.dismissible ? [sendAnotherAction, closeAction] : [sendAnotherAction]
})
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
          :label="t('heritage.form.place')"
          :help="t('heritage.places.help')"
          class="sm:col-span-2"
        >
          <HeritagePlacePicker
            v-model="state.placeId"
            v-model:query="placeQuery"
            @selection="form?.clear('place')"
          />
        </UFormField>
        <UFormField
          name="name"
          :label="t('heritage.form.name')"
          :help="t('heritage.form.nameHelp')"
        >
          <UInput
            v-model="state.name"
            :maxlength="SUBMISSION_LIMITS.name.max"
            autocomplete="name"
            autocapitalize="words"
            spellcheck="false"
            class="w-full"
          />
        </UFormField>
        <UFormField
          name="contact"
          :label="t('heritage.form.contact')"
          :help="t('heritage.form.contactHelp')"
        >
          <UInput
            v-model="state.contact"
            autocomplete="email"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            :placeholder="t('heritage.form.contactPlaceholder')"
            :maxlength="SUBMISSION_LIMITS.contact.max"
            class="w-full"
          />
        </UFormField>
      </div>

      <div
        class="sr-only"
        aria-hidden="true"
      >
        <label>
          Website
          <input
            v-model="state.website"
            type="text"
            name="website"
            tabindex="-1"
            autocomplete="off"
          >
        </label>
      </div>

      <i18n-t
        keypath="heritage.form.consent"
        tag="p"
        class="text-xs text-muted"
        scope="global"
      >
        <template #privacy>
          <ULink
            :to="localePath('/potkalnicko-prigorje/privatnost')"
            class="text-primary underline underline-offset-2"
          >
            {{ t('heritage.form.privacyLink') }}
          </ULink>
        </template>
      </i18n-t>

      <UFormField name="consentPublish">
        <UCheckbox
          v-model="state.consentPublish"
          :label="t('heritage.form.consentLabel')"
          required
        />
      </UFormField>

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
          v-if="dismissible"
          :label="t('heritage.form.close')"
          color="neutral"
          variant="ghost"
          @click="closeForm"
        />
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
