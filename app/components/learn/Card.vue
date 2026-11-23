<script setup lang="ts">
import type { CardPool, PoolItem, PoolPerson, PoolPlace, PoolWord } from '~~/shared/utils/learn/types'
import { personArchivePath, poolWordToEntry, settlementArchivePath, wordArchivePath } from '~/utils/learnCard'
import { municipalityLabel, personPlaceLabel } from '~/utils/learnUi'
import { settlementForSlug } from '~/utils/learnPlace'

const props = defineProps<{
  card: PoolWord | PoolPlace | PoolItem | PoolPerson
  pool: CardPool
  /** When set, word cards can offer a local usage confirmation for this settlement slug. */
  placeSlug?: string
  /** True when placeSlug is the signed-in account's saved main place. */
  placeIsMain?: boolean
}>()

const flipped = defineModel<boolean>('flipped', { default: false })
const { t } = useI18n()
const localePath = useLocalePath()

const correctionOpen = ref(false)
const usageOpen = ref(false)
const wordEntry = computed(() => props.card.kind === 'word' ? poolWordToEntry(props.card) : null)

const chosenSettlement = computed(() => settlementForSlug(props.pool, props.placeSlug))
const usagePlacePreset = computed(() => {
  const settlement = chosenSettlement.value
  if (!settlement) return undefined
  return { name: settlement.name, query: settlement.name }
})

const openPath = computed(() => {
  const card = props.card
  if (card.kind === 'word') {
    const path = wordArchivePath(card)
    return path ? localePath(path) : undefined
  }
  if (card.kind === 'place') return localePath(settlementArchivePath(props.pool, card))
  if (card.kind === 'person') return localePath(personArchivePath(card.slug))
  return localePath(card.path)
})
const openLabel = computed(() => t(props.card.kind === 'place' ? 'pz.learn.openSettlement' : 'pz.learn.openRecord'))

const placeUnit = computed(() =>
  props.card.kind === 'place' ? municipalityLabel(props.pool, props.card.municipalityId) : '')

const itemCard = computed(() => props.card.kind === 'item' ? props.card : null)
const personCard = computed(() => props.card.kind === 'person' ? props.card : null)
const placeCard = computed(() => props.card.kind === 'place' ? props.card : null)

const itemSettlement = computed(() => {
  const card = itemCard.value
  if (!card) return ''
  return props.pool.settlements.find(s => s.id === card.settlementId)?.name ?? ''
})

const itemUnit = computed(() =>
  props.card.kind === 'item' ? municipalityLabel(props.pool, props.card.municipalityId) : '')

const kindLabel = computed(() => t(`pz.learn.kind${{ word: 'Word', place: 'Place', item: 'Item', person: 'Person' }[props.card.kind]}`))
const cardName = computed(() => props.card.kind === 'word' ? props.card.headword : props.card.name)

// Space reveals the card from anywhere on the page, but never while a button or link has focus (Space already
// activates those, and it would reveal the card twice).
defineShortcuts({
  space: () => {
    const active = document.activeElement
    if (active instanceof Element && active.closest('button, a, [role="button"]')) return
    flipped.value = true
  }
})

const flashcard = useTemplateRef<{ focus: () => void }>('flashcard')
defineExpose({ focus: () => flashcard.value?.focus() })

const announce = computed(() => {
  if (props.card.kind === 'word') return `${props.card.headword}: ${props.card.meaning}`
  if (props.card.kind === 'person') return `${props.card.name}: ${props.card.role}`
  return cardName.value
})
</script>

<template>
  <LearnFlashcard
    ref="flashcard"
    v-model:flipped="flipped"
    :label="t('pz.learn.flipLabel', { name: cardName })"
    :announce="announce"
  >
    <template #front>
      <p class="pz-overline text-muted">
        {{ kindLabel }}
      </p>
      <p
        v-if="personCard"
        class="pz-h2 wrap-anywhere text-highlighted"
      >
        {{ personCard.clue }}
      </p>
      <p
        v-else
        class="font-display text-[clamp(2.25rem,11vw,3.5rem)]/[1.1] font-bold tracking-tight wrap-anywhere text-highlighted"
      >
        {{ cardName }}
      </p>
      <p
        v-if="card.kind === 'word' && card.partOfSpeech"
        class="pz-body-sm text-muted"
      >
        {{ card.partOfSpeech }}
      </p>
      <p
        v-else-if="personCard"
        class="pz-body text-muted"
      >
        {{ t('pz.learn.personPrompt') }}
      </p>
      <p
        v-else-if="card.kind === 'place'"
        class="pz-body text-muted"
      >
        {{ t('pz.learn.placePrompt') }}
      </p>
      <p
        v-else-if="card.kind === 'item'"
        class="pz-body text-muted"
      >
        {{ t('pz.learn.itemPrompt') }}
      </p>
    </template>

    <template #back>
      <p class="pz-overline text-muted">
        {{ kindLabel }}<template v-if="card.kind === 'word' && card.partOfSpeech">
          · {{ card.partOfSpeech }}
        </template>
      </p>
      <p
        v-if="card.kind === 'word'"
        class="font-display text-[1.75rem] font-bold wrap-anywhere text-highlighted"
      >
        {{ cardName }}
      </p>
      <hr class="h-0.5 w-12 border-0 bg-(--ui-border)">
      <div class="flex w-full flex-col items-center gap-3">
        <template v-if="card.kind === 'word' && wordEntry">
          <div>
            <p class="pz-caption text-muted">
              {{ t('pz.learn.meaningLabel') }}
            </p>
            <p class="pz-lead font-semibold text-highlighted">
              {{ card.meaning }}
            </p>
          </div>
          <div
            v-if="wordEntry.variants.length"
            class="border-t border-default pt-3"
          >
            <p class="pz-caption mb-2 flex items-center gap-1.5 font-semibold text-muted">
              <UIcon
                name="i-lucide-git-fork"
                class="size-3.5 shrink-0"
              />
              {{ t('pz.learn.variantsLabel') }}
            </p>
            <HeritageVariantList
              :entry="wordEntry"
              :place-area-id="chosenSettlement?.id"
              :place-is-main="placeIsMain"
              :english="false"
            />
          </div>
        </template>

        <template v-else-if="placeCard">
          <p class="pz-lead font-semibold text-highlighted">
            {{ placeUnit }}
          </p>
          <p class="pz-body-sm text-muted">
            {{ t('pz.learn.placeItemCount', { count: placeCard.itemCount }) }}
          </p>
        </template>

        <template v-else-if="personCard">
          <p class="pz-lead font-semibold text-highlighted">
            {{ personCard.name }}
          </p>
          <p class="pz-body-sm text-muted">
            {{ personCard.years }} · {{ personCard.role }}
          </p>
          <p class="pz-body text-default">
            {{ personPlaceLabel(pool, personCard) }}
          </p>
          <PzVerificationBadge
            :verification="personCard.verification"
            class="self-start"
          />
        </template>

        <template v-else-if="itemCard">
          <p class="pz-lead font-semibold text-highlighted">
            {{ itemCard.name }}
          </p>
          <p class="pz-body text-default">
            {{ itemSettlement }} · {{ itemUnit }} · {{ itemCard.categoryLabel }}
          </p>
          <PzVerificationBadge
            :verification="itemCard.verification"
            class="self-start"
          />
        </template>

        <div class="mt-auto flex flex-col items-start border-t border-default pt-2">
          <UButton
            v-if="openPath"
            :to="openPath"
            :label="openLabel"
            :icon="card.kind === 'place' ? 'i-lucide-map-pin' : 'i-lucide-book-open'"
            color="neutral"
            variant="link"
            class="min-h-(--pz-tap-min) px-0 font-semibold"
            data-testid="learn-open-record"
          />
          <HeritageWordCorrection
            v-if="card.kind === 'word' && wordEntry"
            v-model:open="correctionOpen"
            :entry="wordEntry"
          />
          <UButton
            v-if="card.kind === 'word' && placeSlug && wordEntry"
            :label="t('pz.learn.localUsage')"
            icon="i-lucide-message-circle"
            color="neutral"
            variant="link"
            class="min-h-(--pz-tap-min) px-0 font-semibold"
            aria-haspopup="dialog"
            @click="usageOpen = true"
          />
          <UButton
            v-if="card.kind !== 'word'"
            :label="t('pz.learn.suggestCorrection')"
            icon="i-lucide-pencil"
            color="neutral"
            variant="link"
            class="min-h-(--pz-tap-min) px-0 font-semibold"
            aria-haspopup="dialog"
            @click="correctionOpen = true"
          />
        </div>
      </div>
      <UModal
        v-if="wordEntry"
        v-model:open="usageOpen"
        :title="t('pz.learn.localUsage')"
        :ui="{ content: 'max-w-lg' }"
      >
        <template #body>
          <HeritageSubmissionForm
            :key="`${wordEntry.id}-${placeSlug}`"
            :word="wordEntry.headword"
            :word-id="wordEntry.id"
            intent="usage"
            fixed-type="word"
            hide-type-picker
            :preset-place="usagePlacePreset"
          />
        </template>
      </UModal>
      <HeritageSuggestDialog
        v-if="placeCard"
        v-model:open="correctionOpen"
        kind="area"
        mode="correction"
        :target="{ id: placeCard.id, label: placeCard.name }"
      />
      <HeritageSuggestDialog
        v-else-if="personCard"
        v-model:open="correctionOpen"
        kind="person"
        mode="correction"
        :target="{ id: personCard.id, label: personCard.name }"
      />
      <HeritageSuggestDialog
        v-else-if="itemCard"
        v-model:open="correctionOpen"
        kind="heritage_item"
        mode="correction"
        :target="{ id: itemCard.id, label: itemCard.name }"
      />
    </template>
  </LearnFlashcard>
</template>
