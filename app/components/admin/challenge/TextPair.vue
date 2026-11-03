<script setup lang="ts">
import type { ChallengeText } from '~~/shared/utils/challenge'
import { CHALLENGE_LIMITS } from '~~/shared/utils/content/challengeTemplate'

// One bilingual text of a challenge (Croatian and English side by side). The form fields are named
// `<name>.hr` and `<name>.en`, the paths the shared validator reports problems under.
defineProps<{
  /** Path of the text in the form state, e.g. `content.rounds.0.topic`. */
  name: string
  label: string
  multiline?: boolean
  placeholder?: string
}>()
const model = defineModel<ChallengeText>({ required: true })

const LANGUAGES = [
  { key: 'hr', label: 'hrvatski', lang: 'hr' },
  { key: 'en', label: 'engleski', lang: 'en' }
] as const
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <UFormField
      v-for="language in LANGUAGES"
      :key="language.key"
      :name="`${name}.${language.key}`"
      :label="`${label} (${language.label})`"
      required
    >
      <UTextarea
        v-if="multiline"
        v-model="model[language.key]"
        :lang="language.lang"
        :placeholder="placeholder"
        :maxlength="CHALLENGE_LIMITS.text"
        :rows="2"
        autoresize
        class="w-full"
      />
      <UInput
        v-else
        v-model="model[language.key]"
        :lang="language.lang"
        :placeholder="placeholder"
        :maxlength="CHALLENGE_LIMITS.text"
        class="w-full"
      />
    </UFormField>
  </div>
</template>
