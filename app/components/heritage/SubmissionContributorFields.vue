<script setup lang="ts">
import { SUBMISSION_LIMITS } from '~~/shared/utils/submission'

// Who is sending, plus the publication consent: the part every contribution form shares.
// Must sit inside a UForm, which supplies the field errors.
const name = defineModel<string>('name', { required: true })
const contact = defineModel<string>('contact', { required: true })
const consentPublish = defineModel<boolean>('consentPublish', { required: true })
// Honeypot, hidden from people: see server/api/submissions.post.ts.
const website = defineModel<string>('website', { required: true })
defineProps<{
  /** Opens the privacy notice in a new tab, so a dialog keeps what the visitor has typed. */
  privacyInNewTab?: boolean
}>()

const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <div class="flex flex-col gap-4">
    <fieldset class="grid min-w-0 gap-4 rounded-(--pz-radius-lg) border border-default p-4 sm:grid-cols-2">
      <legend class="pz-label px-1 text-default">
        {{ t('pz.contribute.aboutYou') }}
      </legend>
      <UFormField
        name="name"
        :label="t('heritage.form.name')"
        :help="t('heritage.form.nameHelp')"
      >
        <UInput
          v-model="name"
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
          v-model="contact"
          autocomplete="email"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          :placeholder="t('heritage.form.contactPlaceholder')"
          :maxlength="SUBMISSION_LIMITS.contact.max"
          class="w-full"
        />
      </UFormField>
    </fieldset>

    <div
      class="sr-only"
      aria-hidden="true"
    >
      <label>
        Website
        <input
          v-model="website"
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
          :to="localePath('/privatnost')"
          :target="privacyInNewTab ? '_blank' : undefined"
          class="text-primary underline underline-offset-2"
        >
          {{ t('heritage.form.privacyLink') }}
        </ULink>
      </template>
    </i18n-t>

    <UFormField name="consentPublish">
      <UCheckbox
        v-model="consentPublish"
        :label="t('heritage.form.consentLabel')"
        required
      />
    </UFormField>
  </div>
</template>
