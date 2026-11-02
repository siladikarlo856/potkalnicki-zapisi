<script setup lang="ts">
import type { DailyWordPayload } from '~~/shared/utils/dailyWord'
import { pluralForm } from '~/utils/dailyClues'

const props = defineProps<{
  payload: DailyWordPayload
  solved: boolean
  tries: number
  maxTries: number
}>()

const { locale, t } = useI18n()
const english = computed(() => locale.value === 'en')
const meaning = computed(() => {
  const en = english.value ? props.payload.entry.meaning.en?.trim() : undefined
  return { text: en || props.payload.entry.meaning.hr, lang: en ? 'en' : 'hr' }
})
const note = computed(() => {
  const en = english.value ? props.payload.entry.note?.en?.trim() : undefined
  const text = en || props.payload.entry.note?.hr
  return text ? { text, lang: en ? 'en' : 'hr' } : undefined
})
const example = computed(() => props.payload.entry.examples?.[0])
const title = useTemplateRef<HTMLElement>('title')
defineExpose({ focus: () => title.value?.focus() })
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-3"
    data-testid="daily-reveal"
  >
    <h3
      ref="title"
      tabindex="-1"
      class="flex items-center gap-2 text-lg font-bold text-highlighted outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <UIcon
        :name="solved ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
        class="size-5 shrink-0"
        :class="solved ? 'text-success' : 'text-error'"
      />
      {{ solved ? t(`daily.solved.${pluralForm(locale, tries)}`, { n: tries }) : t('daily.missed') }}
    </h3>
    <p class="text-xs text-muted">
      {{ t('daily.usedTries', { tries: solved ? tries : 'X', max: maxTries }) }}
    </p>
    <div class="flex flex-wrap items-baseline gap-x-2">
      <span class="text-xs text-muted">{{ t('daily.meaning') }}</span>
      <span
        class="text-lg font-bold wrap-anywhere text-highlighted"
        :lang="meaning.lang"
      >{{ meaning.text }}</span>
      <span
        v-if="meaning.lang === 'en'"
        class="text-xs text-muted"
        lang="hr"
      >{{ payload.entry.meaning.hr }}</span>
    </div>
    <p
      v-if="note"
      class="text-sm"
    >
      <span class="font-semibold text-highlighted">{{ t('daily.funFact') }}: </span>
      <span :lang="note.lang">{{ note.text }}</span>
    </p>
    <p
      v-if="example"
      class="text-sm"
      lang="hr"
    >
      <span class="mr-1 text-muted">{{ t('daily.example') }}</span>
      <i>{{ example.text }}</i><span
        v-if="example.translation"
        class="text-muted"
      > — {{ example.translation }}</span>
    </p>
    <div>
      <h4 class="mb-1 text-xs font-semibold text-muted">
        {{ t('daily.variants') }}
      </h4>
      <HeritageVariantList
        :entry="payload.entry"
        :english="english"
        lang="hr"
      />
    </div>
  </div>
</template>
