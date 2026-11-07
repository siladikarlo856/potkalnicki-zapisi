<script setup lang="ts">
import type { LearnCurrent } from '~~/shared/utils/learn/learnState'
import type { CardPool, PoolCard } from '~~/shared/utils/learn/types'
import { pluralFormHr } from '~/utils/plural'
import { cardByKey, gamesHrefWithTopic, knownCount, missedKeys, municipalityLabel, settlementName } from '~/utils/learnUi'
import { personArchivePath, settlementArchivePath, wordArchivePath } from '~/utils/learnCard'

// The end of a session (ScreenLearn): known and to-review as two stat blocks, the cards to review with links, and
// "Nova sesija" as the one primary action (sticky bar on mobile, a button under the list on desktop).
const props = defineProps<{
  pool: CardPool
  session: LearnCurrent
  streak: number
}>()

const { t } = useI18n()
const localePath = useLocalePath()

const known = computed(() => knownCount(props.session.results))
const missed = computed(() => missedKeys(props.session.results))
const great = computed(() => known.value * 10 >= props.session.n * 7)

const repeatLabel = computed(() =>
  t(`pz.learn.repeatMissed.${pluralFormHr(missed.value.length)}`, { k: missed.value.length }))

const sessionPath = computed(() => {
  const q = new URLSearchParams()
  q.set('teme', props.session.topics.join(','))
  q.set('n', String(props.session.n))
  return `/potkalnicko-prigorje/uci/sesija?${q}`
})

const repeatPath = computed(() => {
  const q = new URLSearchParams()
  q.set('kartice', missed.value.join(','))
  return `/potkalnicko-prigorje/uci/sesija?${q}`
})

interface ReviewRow {
  key: string
  kind: string
  label: string
  detail: string
  to?: string
}

function kindLabel(card: PoolCard) {
  const map = { word: 'Word', place: 'Place', item: 'Item', person: 'Person' } as const
  return card.kind in map ? t(`pz.learn.kind${map[card.kind as keyof typeof map]}`) : ''
}

function rowFor(key: string): ReviewRow | null {
  const card = cardByKey(props.pool, key)
  if (!card) return null
  if (card.kind === 'word') {
    const path = wordArchivePath(card)
    return { key, kind: kindLabel(card), label: card.headword, detail: card.meaning, to: path ? localePath(path) : undefined }
  }
  if (card.kind === 'place') {
    return { key, kind: kindLabel(card), label: card.name, detail: municipalityLabel(props.pool, card.municipalityId), to: localePath(settlementArchivePath(card.slug)) }
  }
  if (card.kind === 'item') {
    return { key, kind: kindLabel(card), label: card.name, detail: settlementName(props.pool, card.settlementId), to: localePath(card.path) }
  }
  if (card.kind === 'person') {
    return { key, kind: kindLabel(card), label: card.name, detail: card.role, to: localePath(personArchivePath(card.slug)) }
  }
  return null
}

const rows = computed(() => missed.value.map(rowFor).filter((row): row is ReviewRow => row !== null))
const heading = useTemplateRef<HTMLElement>('heading')
onMounted(() => heading.value?.focus({ preventScroll: true }))
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-6"
    data-testid="learn-summary"
  >
    <section class="flex flex-col gap-2 pt-2">
      <span class="pz-overline text-muted">{{ t('pz.learn.summaryOverline') }}</span>
      <h1
        ref="heading"
        tabindex="-1"
        class="pz-h1 text-highlighted outline-offset-4"
        data-testid="learn-summary-title"
      >
        {{ t(great ? 'pz.learn.summaryGreat' : 'pz.learn.summaryTitle', { known, n: session.n }) }}
      </h1>
      <p
        v-if="streak > 0"
        class="pz-body-sm flex items-center gap-1.5 text-muted"
        data-testid="learn-summary-streak"
      >
        <UIcon
          name="i-lucide-flame"
          class="size-4"
        />
        {{ t('pz.learn.streak', { n: streak }) }}
      </p>
    </section>

    <div class="grid grid-cols-2 gap-2">
      <div
        class="rounded-(--pz-radius-md) border border-success bg-(--pz-success-soft) p-3"
        data-testid="learn-stat-known"
      >
        <b class="pz-numeral block text-default">{{ known }}</b>
        <span class="pz-body-sm text-default">{{ t('pz.learn.statKnown') }}</span>
      </div>
      <div
        class="rounded-(--pz-radius-md) border border-warning bg-(--pz-warning-soft) p-3"
        data-testid="learn-stat-review"
      >
        <b class="pz-numeral block text-default">{{ missed.length }}</b>
        <span class="pz-body-sm text-default">{{ t('pz.learn.statReview') }}</span>
      </div>
    </div>

    <section
      v-if="rows.length"
      class="flex flex-col gap-3"
      aria-labelledby="learn-review-heading"
    >
      <h2
        id="learn-review-heading"
        class="pz-h2 text-highlighted"
      >
        {{ t('pz.learn.reviewHeading') }}
      </h2>
      <ul class="m-0 list-none divide-y divide-default overflow-hidden rounded-(--pz-radius-lg) border border-default bg-default p-0">
        <li
          v-for="row in rows"
          :key="row.key"
          class="relative grid min-h-14 grid-cols-[minmax(0,1fr)_auto_20px] items-center gap-3 px-4 py-3"
          :class="row.to ? 'hover:bg-muted' : ''"
          data-testid="learn-review-row"
        >
          <span class="min-w-0">
            <small class="pz-caption block text-muted">{{ row.kind }}</small>
            <b
              class="pz-h3 wrap-anywhere text-highlighted"
              lang="hr"
            >
              <NuxtLink
                v-if="row.to"
                :to="row.to"
                class="no-underline after:absolute after:inset-0"
                :aria-label="`${t('pz.learn.openRecord')}: ${row.label}`"
              >{{ row.label }}</NuxtLink>
              <template v-else>{{ row.label }}</template>
            </b>
          </span>
          <span
            class="pz-body-sm max-w-40 text-end wrap-anywhere text-muted"
            lang="hr"
          >{{ row.detail }}</span>
          <UIcon
            v-if="row.to"
            name="i-lucide-chevron-right"
            class="size-5 text-muted"
            aria-hidden="true"
          />
          <span v-else />
        </li>
      </ul>
      <p class="pz-body-sm text-muted">
        {{ t('pz.learn.reviewNote') }}
      </p>
    </section>

    <div class="flex flex-col gap-2">
      <UButton
        :to="localePath(sessionPath)"
        :label="t('pz.learn.newSession')"
        size="xl"
        block
        class="hidden lg:flex"
        data-testid="learn-summary-more-desktop"
      />
      <UButton
        v-if="missed.length"
        :to="localePath(repeatPath)"
        :label="repeatLabel"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="outline"
        size="lg"
        block
        data-testid="learn-summary-repeat"
      />
      <UButton
        :to="localePath(gamesHrefWithTopic(session.topics))"
        :label="t('pz.learn.playWithTopics')"
        icon="i-lucide-gamepad-2"
        color="neutral"
        variant="ghost"
        size="lg"
        block
        data-testid="learn-summary-games"
      />
    </div>

    <PzStickyActionBar class="-mx-4 sm:-mx-6">
      <UButton
        :to="localePath(sessionPath)"
        :label="t('pz.learn.newSession')"
        size="xl"
        block
        data-testid="learn-summary-more"
      />
    </PzStickyActionBar>
  </div>
</template>
