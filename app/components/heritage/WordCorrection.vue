<script setup lang="ts">
import type { WordEntry } from '~/types/heritage'

// "Predloži ispravak" next to a word's variant report: the meaning, part of speech or an example is wrong.
// Opens the suggestion dialog for that word; the report of a local form stays in HeritageVariantDialog.
const props = defineProps<{ entry: WordEntry }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()

const current = computed(() => ({
  meaningHr: props.entry.meaning.hr ?? '',
  meaningEn: props.entry.meaning.en ?? '',
  partOfSpeech: props.entry.partOfSpeech ?? ''
}))
</script>

<template>
  <UButton
    :label="t('heritage.suggest.wordCorrection')"
    icon="i-lucide-pencil"
    color="neutral"
    variant="link"
    size="sm"
    class="self-start px-0 print:hidden"
    aria-haspopup="dialog"
    data-testid="word-suggest-correction"
    @click="open = true"
  />
  <HeritageSuggestDialog
    v-model:open="open"
    kind="word"
    mode="correction"
    :target="{ id: entry.id, label: entry.headword }"
    :current="current"
  />
</template>
