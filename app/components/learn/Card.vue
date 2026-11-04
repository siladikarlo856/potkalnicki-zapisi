<script setup lang="ts">
import type { CardPool, PoolItem, PoolPlace, PoolWord } from '~~/shared/utils/learn/types'
import { poolWordToEntry, settlementArchivePath, wordArchivePath } from '~/utils/learnCard'
import { municipalityLabel } from '~/utils/learnUi'
import { settlementForSlug } from '~/utils/learnPlace'

const props = defineProps<{
  card: PoolWord | PoolPlace | PoolItem
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

const placeUnit = computed(() =>
  props.card.kind === 'place' ? municipalityLabel(props.pool, props.card.municipalityId) : '')

const itemCard = computed(() => props.card.kind === 'item' ? props.card : null)
const placeCard = computed(() => props.card.kind === 'place' ? props.card : null)

const itemSettlement = computed(() => {
  const card = itemCard.value
  if (!card) return ''
  return props.pool.settlements.find(s => s.id === card.settlementId)?.name ?? ''
})

const itemUnit = computed(() =>
  props.card.kind === 'item' ? municipalityLabel(props.pool, props.card.municipalityId) : '')

defineShortcuts({
  space: () => { flipped.value = !flipped.value }
})
</script>

<template>
  <div
    class="cursor-pointer perspective-distant"
    data-testid="learn-card"
    lang="hr"
    @click="flipped = !flipped"
  >
    <p
      class="sr-only"
      aria-live="polite"
    >
      <template v-if="flipped && card.kind === 'word'">
        {{ card.headword }}: {{ card.meaning }}
      </template>
    </p>
    <div
      class="relative h-[clamp(15rem,46svh,24rem)] transition-transform duration-500 transform-3d motion-reduce:transition-none"
      :class="{ 'rotate-y-180': flipped }"
    >
      <div
        class="absolute inset-0 flex flex-col overflow-y-auto rounded-xl bg-default p-4 shadow-sm ring ring-default backface-hidden sm:p-5"
        :aria-hidden="flipped"
        :inert="flipped"
      >
        <div class="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p
            v-if="card.kind === 'word'"
            class="text-4xl font-bold tracking-tight text-highlighted sm:text-5xl"
          >
            {{ card.headword }}
          </p>
          <p
            v-else
            class="text-2xl font-bold tracking-tight text-highlighted sm:text-3xl"
          >
            {{ card.name }}
          </p>
          <p
            v-if="card.kind === 'word' && card.partOfSpeech"
            class="text-sm text-muted"
          >
            {{ card.partOfSpeech }}
          </p>
          <p
            v-else-if="card.kind === 'place'"
            class="text-sm text-muted"
          >
            {{ t('pz.learn.placePrompt') }}
          </p>
          <p
            v-else
            class="text-sm text-muted"
          >
            {{ t('pz.learn.itemPrompt') }}
          </p>
        </div>
        <p class="text-center text-xs text-balance text-muted">
          {{ t('pz.learn.flip') }}
        </p>
      </div>

      <div
        class="absolute inset-0 flex rotate-y-180 flex-col gap-3 overflow-y-auto rounded-xl bg-default p-4 shadow-sm ring-2 ring-primary/40 backface-hidden sm:p-5"
        :aria-hidden="!flipped"
        :inert="!flipped"
        @click.stop
      >
        <template v-if="card.kind === 'word' && wordEntry">
          <p class="text-sm text-muted">
            <span class="font-semibold text-default">{{ card.headword }}</span>
            <template v-if="card.partOfSpeech">
              · {{ card.partOfSpeech }}
            </template>
          </p>
          <div>
            <p class="text-xs text-muted">
              Značenje
            </p>
            <p class="text-3xl font-bold text-highlighted">
              {{ card.meaning }}
            </p>
          </div>
          <div
            v-if="wordEntry.variants.length"
            class="border-t border-default pt-3"
          >
            <p class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
              <UIcon
                name="i-lucide-git-fork"
                class="size-3.5 shrink-0"
              />
              Inačice po mjestima
            </p>
            <HeritageVariantList
              :entry="wordEntry"
              :english="false"
            />
          </div>
          <div class="mt-auto flex flex-col gap-1 border-t border-default pt-2">
            <UButton
              v-if="wordArchivePath(card)"
              :to="localePath(wordArchivePath(card)!)"
              :label="t('pz.learn.openRecord')"
              icon="i-lucide-external-link"
              color="neutral"
              variant="link"
              size="sm"
              class="self-start px-0"
              @click.stop
            />
            <HeritageWordCorrection
              v-model:open="correctionOpen"
              :entry="wordEntry"
            />
            <UButton
              v-if="placeSlug && wordEntry"
              :label="t('pz.learn.localUsage')"
              icon="i-lucide-map-pin-check"
              color="neutral"
              variant="link"
              size="sm"
              class="self-start px-0"
              aria-haspopup="dialog"
              @click.stop="usageOpen = true"
            />
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
          </div>
        </template>

        <template v-else-if="placeCard">
          <p class="text-sm text-muted">
            <span class="font-semibold text-default">{{ placeCard.name }}</span>
          </p>
          <p class="text-2xl font-bold text-highlighted">
            {{ placeUnit }}
          </p>
          <p class="text-sm text-muted">
            {{ t('pz.learn.placeItemCount', { count: placeCard.itemCount }) }}
          </p>
          <UButton
            :to="localePath(settlementArchivePath(placeCard.slug))"
            :label="t('pz.learn.openSettlement')"
            icon="i-lucide-map-pin"
            color="neutral"
            variant="link"
            size="sm"
            class="self-start px-0"
            @click.stop
          />
          <UButton
            :label="t('pz.learn.suggestCorrection')"
            icon="i-lucide-pencil"
            color="neutral"
            variant="link"
            size="sm"
            class="self-start px-0"
            aria-haspopup="dialog"
            @click.stop="correctionOpen = true"
          />
          <HeritageSuggestDialog
            v-model:open="correctionOpen"
            kind="area"
            mode="correction"
            :target="{ id: placeCard.id, label: placeCard.name }"
          />
        </template>

        <template v-else-if="itemCard">
          <p class="text-sm text-muted">
            <span class="font-semibold text-default">{{ itemCard.name }}</span>
          </p>
          <p class="text-lg text-highlighted">
            {{ itemSettlement }} · {{ itemUnit }} · {{ itemCard.categoryLabel }}
          </p>
          <PzHeritageStatusBadge :verification="itemCard.verification" />
          <UButton
            :to="localePath(itemCard.path)"
            :label="t('pz.learn.openRecord')"
            icon="i-lucide-external-link"
            color="neutral"
            variant="link"
            size="sm"
            class="self-start px-0"
            @click.stop
          />
          <UButton
            :label="t('pz.learn.suggestCorrection')"
            icon="i-lucide-pencil"
            color="neutral"
            variant="link"
            size="sm"
            class="self-start px-0"
            aria-haspopup="dialog"
            @click.stop="correctionOpen = true"
          />
          <HeritageSuggestDialog
            v-model:open="correctionOpen"
            kind="heritage_item"
            mode="correction"
            :target="{ id: itemCard.id, label: itemCard.name }"
          />
        </template>
      </div>
    </div>
  </div>
</template>
