<script setup lang="ts">
import type { CardKey } from '~~/shared/utils/learn/types'

// "✎ Predloži ispravak" for the card behind a question: words, places and heritage items each use
// the suggestion dialog of their own kind (H3.10).
const props = defineProps<{ card: CardKey }>()
const open = ref(false)
const { t } = useI18n()
const { pool } = useCardPool()

const id = computed(() => props.card.slice(props.card.indexOf(':') + 1))
const poolCard = computed(() => pool.value.cards.find(card => card.key === props.card))
const kind = computed(() => {
  const prefix = props.card.split(':')[0]
  return prefix === 'word' ? 'word' : prefix === 'place' ? 'area' : prefix === 'item' ? 'heritage_item' : 'person'
})
const label = computed(() => {
  const card = poolCard.value
  if (!card) return id.value
  return card.kind === 'word' ? card.headword : card.name
})
const current = computed<Record<string, string | undefined>>(() => {
  const card = poolCard.value
  if (!card) return {}
  if (card.kind === 'word') return { meaningHr: card.meaning, meaningEn: card.meaningEn ?? '', partOfSpeech: card.partOfSpeech ?? '' }
  if (card.kind === 'place' || card.kind === 'item') return { name: card.name }
  return {}
})
</script>

<template>
  <UButton
    :label="t('pz.play.suggest')"
    icon="i-lucide-pencil"
    color="neutral"
    variant="link"
    size="sm"
    class="self-start px-0 print:hidden"
    aria-haspopup="dialog"
    data-testid="game-suggest"
    @click="open = true"
  />
  <HeritageSuggestDialog
    v-model:open="open"
    :kind="kind"
    mode="correction"
    :target="{ id, label }"
    :current="current"
  />
</template>
