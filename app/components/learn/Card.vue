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
  if (card.kind === 'place') return localePath(settlementArchivePath(card.slug))
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

// Space turns the card from anywhere on the page, but never while a button or link has focus (Space already
// activates those, and it would turn the card twice).
defineShortcuts({
  space: () => {
    const active = document.activeElement
    if (active instanceof Element && active.closest('button, a, [role="button"]')) return
    flipped.value = !flipped.value
  }
})

// A turned card hides one face (inert), so focus follows the turn instead of falling back to the page.
const frontToggle = useTemplateRef<HTMLButtonElement>('frontToggle')
const backToggle = useTemplateRef<HTMLButtonElement>('backToggle')
watch(flipped, async (value) => {
  await nextTick()
  ;(value ? backToggle.value : frontToggle.value)?.focus({ preventScroll: true })
})
defineExpose({ focus: () => (flipped.value ? backToggle.value : frontToggle.value)?.focus() })

function onBackClick(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest('a, button, [role="dialog"]')) return
  flipped.value = false
}
</script>

<template>
  <div
    class="perspective-distant"
    data-testid="learn-card"
    :data-flipped="flipped"
    lang="hr"
  >
    <!-- The faces swap visually, so screen readers hear the answer through this live region. -->
    <p
      class="sr-only"
      aria-live="polite"
    >
      <template v-if="flipped && card.kind === 'word'">
        {{ card.headword }}: {{ card.meaning }}
      </template>
      <template v-else-if="flipped && card.kind === 'person'">
        {{ card.name }}: {{ card.role }}
      </template>
    </p>
    <div
      class="relative h-[clamp(24rem,60svh,30rem)]"
      data-flip-inner
    >
      <!-- Front: pz-wheat, and the whole card is one button. -->
      <div
        data-flip-face="front"
        class="absolute inset-0 flex flex-col overflow-y-auto rounded-(--pz-radius-lg) border border-accented bg-(--pz-wheat) p-5 text-default print:aria-hidden:hidden"
        :aria-hidden="flipped"
        :inert="flipped"
      >
        <button
          ref="frontToggle"
          type="button"
          class="absolute inset-0 z-10 cursor-pointer rounded-(--pz-radius-lg)"
          :aria-expanded="flipped"
          :aria-label="t('pz.learn.flipLabel', { name: cardName })"
          data-testid="learn-card-front"
          @click="flipped = !flipped"
        />
        <span class="pz-overline text-default">{{ kindLabel }}</span>
        <div class="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p
            v-if="personCard"
            class="pz-h2 wrap-anywhere text-highlighted"
          >
            {{ personCard.clue }}
          </p>
          <p
            v-else
            class="pz-headword wrap-anywhere text-highlighted"
          >
            {{ cardName }}
          </p>
          <p
            v-if="card.kind === 'word' && card.partOfSpeech"
            class="pz-body-sm text-default"
          >
            {{ card.partOfSpeech }}
          </p>
          <p
            v-else-if="personCard"
            class="pz-body text-default"
          >
            {{ t('pz.learn.personPrompt') }}
          </p>
          <p
            v-else-if="card.kind === 'place'"
            class="pz-body text-default"
          >
            {{ t('pz.learn.placePrompt') }}
          </p>
          <p
            v-else-if="card.kind === 'item'"
            class="pz-body text-default"
          >
            {{ t('pz.learn.itemPrompt') }}
          </p>
        </div>
        <p class="pz-body-sm text-center text-default pointer-fine:hidden">
          <UIcon
            name="i-lucide-pointer"
            class="mr-1 inline-block size-3.5 align-[-0.2em]"
          />{{ t('pz.learn.flipHint') }}
        </p>
        <p class="pz-body-sm hidden text-center text-default pointer-fine:block">
          <UIcon
            name="i-lucide-mouse-pointer-click"
            class="mr-1 inline-block size-3.5 align-[-0.2em]"
          />{{ t('pz.learn.flipHintFine') }}
        </p>
      </div>

      <!-- Back: the answer, its links and the ways to correct it. -->
      <div
        data-flip-face="back"
        class="absolute inset-0 flex flex-col gap-3 overflow-y-auto rounded-(--pz-radius-lg) border border-accented bg-default p-5 print:aria-hidden:hidden"
        :aria-hidden="!flipped"
        :inert="!flipped"
        @click="onBackClick"
      >
        <button
          ref="backToggle"
          type="button"
          class="-mt-1 -ms-2 flex min-h-(--pz-tap-min) cursor-pointer items-center gap-1.5 self-start px-2 text-start"
          aria-expanded="true"
          :aria-label="t('pz.learn.flipBack')"
          data-testid="learn-card-back"
          @click="flipped = false"
        >
          <UIcon
            name="i-lucide-rotate-ccw"
            class="size-4 shrink-0 text-muted"
          />
          <span class="pz-overline text-default">{{ kindLabel }} · {{ cardName }}<template v-if="card.kind === 'word' && card.partOfSpeech"> · {{ card.partOfSpeech }}</template></span>
        </button>

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
      </div>
    </div>
  </div>
</template>

<style scoped>
/* A 400ms turn about the Y axis. */
[data-flip-inner] {
  transition: transform 400ms cubic-bezier(0.2, 0.8, 0.2, 1);
  transform-style: preserve-3d;
}
[data-flipped="true"] > [data-flip-inner] {
  transform: rotateY(180deg);
}
[data-flip-face] {
  backface-visibility: hidden;
}
[data-flip-face="back"] {
  transform: rotateY(180deg);
}

/* Reduced motion: no turn, a 120ms crossfade between the faces. */
@media (prefers-reduced-motion: reduce) {
  [data-flip-inner] {
    transition: none;
  }
  [data-flipped="true"] > [data-flip-inner] {
    transform: none;
  }
  [data-flip-face] {
    backface-visibility: visible;
    transition: opacity 120ms linear;
  }
  [data-flip-face="back"] {
    transform: none;
    opacity: 0;
  }
  [data-flipped="true"] [data-flip-face="back"] {
    opacity: 1;
  }
  [data-flipped="true"] [data-flip-face="front"] {
    opacity: 0;
  }
}

/* Print shows only the face that is up, unrotated. */
@media print {
  [data-flip-inner],
  [data-flipped="true"] > [data-flip-inner],
  [data-flip-face="back"] {
    transform: none;
  }
}
</style>
