<script setup lang="ts">
import type { ContributionKind } from '~~/shared/utils/contribution'
import { decodeCardKey, encodeCardKey } from '~~/shared/utils/games/cardKey'
import type { CardKey, CardKind } from '~~/shared/utils/learn/types'

// "✎ Predloži ispravak" for the card behind a question: every card kind uses the suggestion dialog
// of its own content kind (H3.10). A question's key may carry a game suffix (`club:<id>:mjesto`);
// the Correction is always about the plain card.
const props = defineProps<{ card: CardKey }>()
const open = ref(false)
const { t } = useI18n()
const { pool } = useCardPool()

const CONTRIBUTION_KIND: Record<CardKind, ContributionKind> = {
  word: 'word',
  place: 'area',
  item: 'heritage_item',
  person: 'person',
  club: 'club'
}

const parts = computed(() => decodeCardKey(props.card))
const id = computed(() => parts.value?.id ?? '')
const poolCard = computed(() => {
  const card = parts.value
  if (!card) return undefined
  const key = encodeCardKey({ kind: card.kind, id: card.id })
  return pool.value.cards.find(item => item.key === key)
})
const kind = computed(() => CONTRIBUTION_KIND[parts.value?.kind ?? 'word'])
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
  if (card.kind === 'club') return { name: card.name, sport: card.sport, competition: card.seniorSeason?.competition ?? '' }
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
