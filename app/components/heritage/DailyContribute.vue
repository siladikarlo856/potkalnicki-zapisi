<script setup lang="ts">
import type { SubmissionIntent } from '~~/shared/utils/submission'

// After the reveal a player can help the editors: send their own form, or confirm the word is used in
// their place. Both send the word's id, so the submission arrives in the review already linked to it.
const props = defineProps<{ wordId: string, headword: string }>()
const { t } = useI18n()

const intents = [
  { id: 'variant', icon: 'i-lucide-message-square-text', label: 'daily.contribute.variant' },
  { id: 'usage', icon: 'i-lucide-map-pin-check', label: 'daily.contribute.usage' }
] as const satisfies ReadonlyArray<{ id: SubmissionIntent, icon: string, label: string }>

const open = ref<SubmissionIntent>()
const formPanel = useTemplateRef<HTMLElement>('formPanel')
const triggers = useTemplateRef<Array<{ $el: HTMLElement }>>('triggers')

async function toggle(intent: SubmissionIntent) {
  open.value = open.value === intent ? undefined : intent
  if (!open.value) return
  await nextTick()
  formPanel.value?.focus()
}
async function close() {
  const intent = open.value
  open.value = undefined
  await nextTick()
  triggers.value?.[intents.findIndex(item => item.id === intent)]?.$el.focus()
}
</script>

<template>
  <section
    class="flex min-w-0 flex-col gap-2 print:hidden"
    aria-labelledby="daily-contribute-title"
    data-testid="daily-contribute"
  >
    <h3
      id="daily-contribute-title"
      class="text-sm font-semibold text-highlighted"
    >
      {{ t('daily.contribute.title') }}
    </h3>
    <div class="grid gap-2 sm:grid-cols-2">
      <UButton
        v-for="intent in intents"
        ref="triggers"
        :key="intent.id"
        :icon="intent.icon"
        :label="t(intent.label)"
        :aria-expanded="open === intent.id"
        :data-testid="`daily-contribute-${intent.id}`"
        :color="open === intent.id ? 'primary' : 'neutral'"
        variant="outline"
        block
        class="min-h-11 justify-start whitespace-normal"
        @click="toggle(intent.id)"
      />
    </div>
    <div
      v-if="open"
      ref="formPanel"
      tabindex="-1"
      class="flex flex-col gap-2 outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
      data-testid="daily-contribute-form"
    >
      <HeritageSubmissionForm
        :key="open"
        :word="props.headword"
        :word-id="props.wordId"
        :intent="open"
        fixed-type="word"
        hide-type-picker
      />
      <UButton
        :label="t('daily.contribute.close')"
        color="neutral"
        variant="link"
        class="self-start px-0"
        @click="close"
      />
    </div>
  </section>
</template>
