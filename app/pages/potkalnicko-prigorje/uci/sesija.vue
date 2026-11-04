<script setup lang="ts">
import type { LearnCurrent, LearnN } from '~~/shared/utils/learn/learnState'
import {
  answerInSession,
  createSession,
  filterCurrentToPool,
  parseCardKeyList,
  sessionComplete
} from '~~/shared/utils/learn/learnState'
import { buildSession } from '~~/shared/utils/learn/session'
import type { TopicId } from '~~/shared/utils/learn/types'
import { cardByKey, isDisplayCard } from '~/utils/learnUi'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { pool, status, error, refresh } = useCardPool()
const learn = useLearnState()
const { cards, streak, recordAnswer, recordSeenCard } = useProgress()

useSeoMeta({
  title: () => t('pz.learn.sessionSeoTitle'),
  ogTitle: () => `${t('pz.learn.title')} · Potkalnički zapisi`
})

const ready = ref(false)
const flipped = ref(false)
const seen = ref(false)
const finished = ref<LearnCurrent | null>(null)
const unavailable = ref(false)
const session = ref<LearnCurrent | null>(null)
const targetN = ref(10)

const poolKeySet = computed(() => new Set(pool.value.cards.map(c => c.key)))

function localDay() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function parseTopics(raw: string | undefined): TopicId[] {
  if (!raw) return ['rijeci']
  return raw.split(',').filter(Boolean) as TopicId[]
}

function initSession() {
  unavailable.value = false
  finished.value = null
  flipped.value = false
  seen.value = false
  learn.load()

  const valid = poolKeySet.value
  const today = localDay()
  const progress = { ...cards.value } as Record<string, import('~~/shared/utils/learn/leitner').CardProgress>

  if (route.query.nastavi === '1' && learn.current.value) {
    const filtered = filterCurrentToPool(learn.current.value, valid)
    if (!filtered) {
      unavailable.value = true
      session.value = null
      return
    }
    session.value = filtered
    targetN.value = filtered.n
    learn.setCurrent(filtered)
    return
  }

  if (route.query.ponovi === '1') {
    const due = buildSession(pool.value, progress, {
      n: 20,
      topics: pool.value.topics.filter(t => t.status === 'live' && !t.parent).map(t => t.id),
      today,
      mode: 'review'
    })
    const queue = due.slice(0, Math.min(due.length, 20))
    if (!queue.length) {
      unavailable.value = true
      return
    }
    const topics = parseTopics(typeof route.query.teme === 'string' ? route.query.teme : undefined)
    const reviewN = (Math.min(queue.length, 20) <= 5 ? 5 : Math.min(queue.length, 20) <= 10 ? 10 : 20) as LearnN
    const next = createSession(topics, reviewN, queue, 'review')
    session.value = next
    targetN.value = queue.length
    learn.setCurrent(next)
    return
  }

  if (typeof route.query.kartice === 'string') {
    const queue = parseCardKeyList(route.query.kartice, valid)
    if (!queue.length) {
      unavailable.value = true
      return
    }
    const next = createSession([], 10, queue, 'list')
    next.n = Math.min(queue.length, 20) as LearnN
    session.value = next
    targetN.value = queue.length
    learn.setCurrent(next)
    return
  }

  const topics = parseTopics(typeof route.query.teme === 'string' ? route.query.teme : undefined)
  const qn = Number(route.query.n)
  const n: LearnN = qn === 5 || qn === 10 || qn === 20 ? qn : 10
  const queue = buildSession(pool.value, progress, { n, topics, today, mode: 'new' })
  if (!queue.length) {
    unavailable.value = true
    return
  }
  learn.rememberSetup(topics, n)
  const next = createSession(topics, n, queue, 'new')
  session.value = next
  targetN.value = queue.length
  learn.setCurrent(next)
}

const active = computed(() => session.value)
const currentKey = computed(() => active.value?.queue[active.value.index])
const currentCard = computed(() => {
  const key = currentKey.value
  if (!key) return undefined
  const card = cardByKey(pool.value, key)
  return isDisplayCard(card) ? card : undefined
})

const counter = computed(() => {
  if (!active.value) return { i: 0, n: 0 }
  const n = targetN.value
  const answered = Object.keys(active.value.results).length
  const key = active.value.queue[active.value.index]
  const i = key && !Object.hasOwn(active.value.results, key) ? answered + 1 : answered
  return { i: Math.min(i, n), n }
})

watch(flipped, (value) => {
  if (value && !seen.value && currentKey.value) {
    seen.value = true
    recordSeenCard(currentKey.value)
  }
})

async function score(knew: boolean) {
  if (!active.value || !currentKey.value || !seen.value) return
  recordAnswer(currentKey.value, knew)
  const next = answerInSession(active.value, knew)
  flipped.value = false
  seen.value = false
  if (sessionComplete(next)) {
    finished.value = next
    session.value = null
    learn.setCurrent(null)
  } else {
    session.value = next
    learn.setCurrent(next)
  }
  await nextTick()
}

defineShortcuts(computed(() => ({
  space: currentCard.value && !finished.value ? () => { flipped.value = !flipped.value } : false
})))

onMounted(() => {
  if (status.value === 'success' || pool.value.cards.length) {
    initSession()
    ready.value = true
  }
})

watch(() => status.value, (s) => {
  if (s === 'success' && !ready.value) {
    initSession()
    ready.value = true
  }
})
</script>

<template>
  <UContainer class="py-6">
    <UButton
      :to="localePath('/potkalnicko-prigorje/uci')"
      :label="t('pz.learn.title')"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="link"
      size="sm"
      class="-ms-0.5 mb-2 px-0"
    />

    <div
      v-if="!ready || status === 'pending'"
      class="space-y-3"
    >
      <USkeleton class="h-8 w-48" />
      <USkeleton class="h-64 w-full" />
    </div>

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      :title="t('pz.learn.loadError')"
    >
      <UButton
        :label="t('game.retry')"
        variant="link"
        @click="refresh()"
      />
    </UAlert>

    <div
      v-else-if="unavailable"
      class="rounded-xl bg-default p-6 ring ring-default"
      data-testid="learn-unavailable"
    >
      <p class="text-highlighted">
        {{ t('pz.learn.sessionUnavailable') }}
      </p>
      <UButton
        :to="localePath('/potkalnicko-prigorje/uci')"
        :label="t('pz.learn.title')"
        class="mt-4"
      />
    </div>

    <LearnSummary
      v-else-if="finished"
      :pool="pool"
      :session="finished"
      :streak="streak"
    />

    <div
      v-else-if="currentCard && active"
      class="mx-auto flex max-w-md flex-col gap-3"
      data-testid="learn-runner"
    >
      <div class="flex items-center justify-between text-sm text-muted">
        <span>{{ t('pz.learn.counter', counter) }}</span>
      </div>
      <UProgress
        :model-value="counter.i - 1"
        :max="counter.n"
        size="sm"
        aria-hidden="true"
      />

      <LearnCard
        :key="currentKey"
        v-model:flipped="flipped"
        :card="currentCard"
        :pool="pool"
      />

      <UButton
        :label="t('pz.learn.flip')"
        icon="i-lucide-rotate-3d"
        :color="seen ? 'neutral' : 'primary'"
        :variant="seen ? 'outline' : 'solid'"
        size="xl"
        block
        @click="flipped = !flipped"
      />

      <div
        v-if="seen"
        class="grid grid-cols-2 gap-2"
      >
        <UButton
          :label="t('pz.learn.unknown')"
          color="neutral"
          variant="subtle"
          size="xl"
          block
          data-testid="learn-unknown"
          @click="score(false)"
        />
        <UButton
          :label="t('pz.learn.known')"
          size="xl"
          block
          data-testid="learn-known"
          @click="score(true)"
        />
      </div>
    </div>
  </UContainer>
</template>
