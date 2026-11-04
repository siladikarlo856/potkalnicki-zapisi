<script setup lang="ts">
import type { LearnCurrent } from '~~/shared/utils/learn/learnState'
import type { CardPool } from '~~/shared/utils/learn/types'
import { pluralFormHr } from '~/utils/plural'
import {
  cardByKey,
  gamesHrefWithTopic,
  knownCount,
  missedKeys,
  topicStats
} from '~/utils/learnUi'
import { poolWordToEntry, settlementArchivePath, wordArchivePath } from '~/utils/learnCard'

const props = defineProps<{
  pool: CardPool
  session: LearnCurrent
  streak: number
}>()

const { t } = useI18n()
const localePath = useLocalePath()

const byKey = computed(() => new Map(props.pool.cards.map(c => [c.key, c])))
const known = computed(() => knownCount(props.session.results))
const missed = computed(() => missedKeys(props.session.results))
const topics = computed(() => topicStats(props.pool, props.session.topics, props.session.results, byKey.value))

const againLabel = computed(() =>
  t(`pz.learn.more.${pluralFormHr(props.session.n)}`, { n: props.session.n }))

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

function archivePath(key: string) {
  const card = cardByKey(props.pool, key)
  if (!card) return undefined
  if (card.kind === 'word') return wordArchivePath(card) ? localePath(wordArchivePath(card)!) : undefined
  if (card.kind === 'place') return localePath(settlementArchivePath(card.slug))
  if (card.kind === 'item') return localePath(card.path)
  return undefined
}

function cardLabel(key: string) {
  const card = cardByKey(props.pool, key)
  if (!card || card.kind === 'person') return key
  return card.kind === 'word' ? card.headword : card.name
}
</script>

<template>
  <div
    class="flex flex-col gap-4 rounded-xl bg-default p-4 ring ring-default sm:p-6"
    data-testid="learn-summary"
  >
    <h2 class="text-xl font-bold text-highlighted">
      {{ t('pz.learn.summaryTitle', { known, n: session.n }) }}
    </h2>

    <ul class="space-y-1 text-sm text-muted">
      <li
        v-for="row in topics"
        :key="row.topicId"
      >
        {{ row.label }}: {{ row.learned }}/{{ row.total }} {{ t('pz.learn.learnedLabel') }}
      </li>
    </ul>

    <div v-if="missed.length">
      <h3 class="mb-2 text-sm font-semibold text-highlighted">
        {{ t('pz.learn.reviewHeading', { k: missed.length }) }}
      </h3>
      <ul class="flex flex-col gap-2 text-sm">
        <li
          v-for="key in missed"
          :key="key"
          class="flex flex-wrap items-center gap-2"
        >
          <span
            lang="hr"
            class="font-medium text-highlighted"
          >{{ cardLabel(key) }}</span>
          <UButton
            v-if="archivePath(key)"
            :to="archivePath(key)"
            icon="i-lucide-external-link"
            color="neutral"
            variant="link"
            size="xs"
            :aria-label="t('pz.learn.openRecord')"
          />
          <HeritageWordCorrection
            v-if="cardByKey(pool, key)?.kind === 'word'"
            :entry="poolWordToEntry(cardByKey(pool, key)! as import('~~/shared/utils/learn/types').PoolWord)"
          />
        </li>
      </ul>
    </div>

    <p
      v-if="streak > 0"
      class="text-sm text-muted"
    >
      🔥 {{ streak }}
    </p>

    <div class="flex flex-col gap-2">
      <UButton
        :to="localePath(sessionPath)"
        :label="againLabel"
        size="lg"
        data-testid="learn-summary-more"
      />
      <UButton
        v-if="missed.length"
        :to="localePath(repeatPath)"
        :label="repeatLabel"
        color="neutral"
        variant="outline"
        data-testid="learn-summary-repeat"
      />
      <UButton
        :to="localePath(gamesHrefWithTopic(session.topics))"
        :label="t('pz.learn.playWithTopics')"
        color="neutral"
        variant="outline"
        data-testid="learn-summary-games"
      />
    </div>
  </div>
</template>
