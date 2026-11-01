<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import type { WordEntry } from '~/types/heritage'
import { validateSubmission } from '~~/shared/utils/submission'
import { VARIANT_REPORT_LIMITS, buildVariantReportText } from '~~/shared/utils/variantReport'

// "Kod nas se kaže drugačije": report how one word is said locally. Used on the cards and in the quiz.
const props = defineProps<{
  /** The word the report is about. */
  entry?: WordEntry
}>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const { locale, toFormErrors, submit } = useSubmissionRequest()

function emptyState() {
  return { variant: '', example: '', placeId: null as string | null, name: '', contact: '', consentPublish: false, website: '' }
}
const state = reactive(emptyState())
const placeQuery = ref('')
const form = useTemplateRef('form')
const variantInput = useTemplateRef<{ inputRef: HTMLInputElement | null }>('variantInput')
const closeButton = useTemplateRef<{ $el: HTMLElement }>('closeButton')
const sendState = ref<'idle' | 'sending' | 'sent' | 'error'>('idle')
const sendError = ref('')

// Every opening starts clean, so a report never carries over to the next word.
watch(open, (value) => {
  if (!value) return
  Object.assign(state, emptyState())
  placeQuery.value = ''
  sendState.value = 'idle'
  sendError.value = ''
})

// Focus the first field, not the close button the dialog would otherwise start on.
// Escape first closes an open place list; only a second press closes the dialog.
const content = {
  onOpenAutoFocus: (event: Event) => {
    event.preventDefault()
    variantInput.value?.inputRef?.focus()
  },
  onEscapeKeyDown: (event: KeyboardEvent) => {
    if (document.activeElement?.getAttribute('aria-expanded') === 'true') event.preventDefault()
  }
}

const text = computed(() => props.entry
  ? buildVariantReportText(
      { headword: props.entry.headword, variant: state.variant, example: state.example },
      t('heritage.form.prefill', { word: props.entry.headword }),
      t('heritage.variantDialog.exampleLine')
    )
  : '')

function validate(): FormError[] {
  const errors: FormError[] = []
  if (!state.variant.trim()) errors.push({ name: 'variant', message: t('heritage.variantDialog.errors.variantRequired') })
  else if (state.variant.trim().length > VARIANT_REPORT_LIMITS.variant.max) errors.push({ name: 'variant', message: t('heritage.form.errors.tooLong', { max: VARIANT_REPORT_LIMITS.variant.max }) })
  if (state.example.trim().length > VARIANT_REPORT_LIMITS.example.max) errors.push({ name: 'example', message: t('heritage.form.errors.tooLong', { max: VARIANT_REPORT_LIMITS.example.max }) })

  // The shared rules decide place, contact and consent; the sentence is built from the two fields above.
  const result = validateSubmission({ text: text.value || 'xx', type: 'word', placeId: state.placeId, name: state.name, contact: state.contact, consentPublish: state.consentPublish, locale: locale.value })
  if (!result.ok) errors.push(...toFormErrors(result.issues.filter(issue => issue.field !== 'text' && issue.field !== 'type')))
  if (placeQuery.value.trim() && !state.placeId) errors.push({ name: 'place', message: t('heritage.places.choose') })
  return errors
}

async function send() {
  if (!props.entry || sendState.value === 'sending') return
  sendState.value = 'sending'
  const outcome = await submit({
    text: text.value,
    type: 'word',
    placeId: state.placeId,
    name: state.name,
    contact: state.contact,
    consentPublish: state.consentPublish,
    website: state.website
  })
  if (outcome.ok) {
    sendState.value = 'sent'
    await nextTick()
    closeButton.value?.$el.focus()
    return
  }
  if (outcome.issues) form.value?.setErrors(toFormErrors(outcome.issues.filter(issue => issue.field !== 'text' && issue.field !== 'type')))
  sendError.value = outcome.message
  sendState.value = 'error'
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('heritage.variantDialog.title')"
    :description="t('heritage.variantDialog.description')"
    :content="content"
    :ui="{ content: 'max-w-lg', body: 'pb-6' }"
  >
    <template #body>
      <div
        v-if="entry"
        class="flex flex-col gap-4"
      >
        <div
          class="rounded-lg bg-elevated px-3 py-2"
          data-testid="variant-dialog-word"
        >
          <p class="text-xs text-muted">
            {{ t('heritage.variantDialog.word') }}
          </p>
          <p
            class="text-lg font-bold wrap-anywhere text-highlighted"
            lang="hr"
          >
            {{ entry.headword }}<span
              v-if="entry.partOfSpeech"
              class="ms-2 text-xs font-normal text-muted"
            >{{ entry.partOfSpeech }}</span>
          </p>
          <p
            class="text-sm wrap-anywhere"
            lang="hr"
          >
            <span class="text-muted">{{ t('heritage.variantDialog.meaning') }}: </span>{{ entry.meaning.hr }}
          </p>
        </div>

        <div
          v-if="sendState === 'sent'"
          class="flex flex-col items-start gap-3"
        >
          <UAlert
            :title="t('heritage.form.successTitle')"
            :description="t('heritage.form.successDescription')"
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
            @click="open = false"
          />
        </div>

        <UForm
          v-else
          ref="form"
          :state="state"
          :validate="validate"
          novalidate
          class="flex flex-col gap-4"
          @submit="send"
        >
          <UFormField
            name="variant"
            :label="t('heritage.variantDialog.variant')"
            :help="t('heritage.variantDialog.variantHelp')"
            required
          >
            <UInput
              ref="variantInput"
              v-model="state.variant"
              :maxlength="VARIANT_REPORT_LIMITS.variant.max"
              autocapitalize="off"
              spellcheck="false"
              lang="hr"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="place"
            :label="t('heritage.form.place')"
            :help="t('heritage.places.help')"
          >
            <HeritagePlacePicker
              v-model="state.placeId"
              v-model:query="placeQuery"
              @selection="form?.clear('place')"
            />
          </UFormField>

          <UFormField
            name="example"
            :label="t('heritage.variantDialog.example')"
          >
            <UTextarea
              v-model="state.example"
              :rows="2"
              :maxrows="6"
              autoresize
              :maxlength="VARIANT_REPORT_LIMITS.example.max"
              :placeholder="t('heritage.variantDialog.examplePlaceholder')"
              lang="hr"
              class="w-full"
            />
          </UFormField>

          <HeritageSubmissionContributorFields
            v-model:name="state.name"
            v-model:contact="state.contact"
            v-model:consent-publish="state.consentPublish"
            v-model:website="state.website"
            privacy-in-new-tab
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

          <div class="flex flex-wrap justify-end gap-2">
            <UButton
              :label="t('heritage.variantDialog.cancel')"
              color="neutral"
              variant="ghost"
              @click="open = false"
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
      </div>
    </template>
  </UModal>
</template>
