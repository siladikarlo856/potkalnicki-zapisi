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
import { buildLearnReviewQuestion, shouldAskReviewQuestion } from '~~/shared/utils/learn/reviewQuestion'
import type { CardKey, PoolItem, PoolPerson, PoolPlace, PoolWord, TopicId } from '~~/shared/utils/learn/types'
import type { GameQuestion } from '~~/shared/utils/games/types'
import { cardByKey, isDisplayCard } from '~/utils/learnUi'

type DisplayCardType = PoolWord | PoolPlace | PoolItem | PoolPerson

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
const placeSlug = ref<string | undefined>()
const sessionDay = ref('')

const poolKeySet = computed(() => new Set(pool.value.cards.map(c => c.key)))

function localDay() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function parseTopics(raw: string | undefined): TopicId[] {
  if (!raw) return ['rijeci']
  return raw.split(',').filter(Boolean) as TopicId[]
}

function parsePlace(): string | undefined {
  const q = route.query.mjesto
  if (typeof q === 'string' && q.trim()) return q.trim()
  return learn.place.value
}

function initSession() {
  unavailable.value = false
  finished.value = null
  flipped.value = false
  seen.value = false
  learn.load()

  const valid = poolKeySet.value
  const today = localDay()
  sessionDay.value = today
  const place = parsePlace()
  placeSlug.value = place
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
      mode: 'review',
      place
    })
    const queue = due.slice(0, Math.min(due.length, 20))
    if (!queue.length) {
      unavailable.value = true
      return
    }
    const topics = parseTopics(typeof route.query.teme === 'string' ? route.query.teme : undefined)
    const reviewN = (Math.min(queue.length, 20) <= 5 ? 5 : Math.min(queue.length, 20) <= 10 ? 10 : 20) as LearnN
    const next = createSession(topics, reviewN, queue, 'review', place)
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
  const queue = buildSession(pool.value, progress, { n, topics, today, mode: 'new', place })
  if (!queue.length) {
    unavailable.value = true
    return
  }
  learn.rememberSetup(topics, n)
  const next = createSession(topics, n, queue, 'new', place)
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

// While a review answer waits for Dalje the session has already moved on (or finished), so the progress row
// keeps showing the session the held card belongs to.
const shownSession = computed(() => session.value ?? (reviewHold.value ? finished.value : null))

const counter = computed(() => {
  const current = shownSession.value
  if (!current) return { i: 0, n: 0 }
  const n = targetN.value
  const answered = Object.keys(current.results).length
  if (reviewHold.value) return { i: Math.min(Math.max(answered, 1), n), n }
  const key = current.queue[current.index]
  const i = key && !Object.hasOwn(current.results, key) ? answered + 1 : answered
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

const reviewQuestion = computed(() => {
  const key = currentKey.value
  if (!key || !active.value) return null
  if (!shouldAskReviewQuestion(active.value.mode, key, cards.value, sessionDay.value, active.value.results)) {
    return null
  }
  return buildLearnReviewQuestion(pool.value, key)
})

// A due card is asked as multiple choice. The answer is saved as soon as it is picked, but the player stays on
// the question (with its feedback) until Dalje: `reviewHold` keeps that card on screen while the session has moved on.
const reviewHold = ref<{ key: CardKey, card: DisplayCardType, question: GameQuestion } | null>(null)
const reviewStep = ref(0)
const reviewShown = computed(() => {
  if (reviewHold.value) return reviewHold.value
  const key = currentKey.value
  const card = currentCard.value
  const question = reviewQuestion.value
  return active.value && key && card && question ? { key, card, question } : null
})

async function scoreReview(correct: boolean) {
  const shown = reviewShown.value
  if (!shown || !active.value || reviewHold.value) return
  reviewHold.value = shown
  seen.value = true
  recordSeenCard(shown.key)
  await score(correct)
}

async function reviewNext() {
  reviewHold.value = null
  reviewStep.value += 1
  await nextTick()
  document.getElementById('learn-review-prompt')?.focus()
}

async function grade(knew: boolean) {
  await score(knew)
  await nextTick()
  card.value?.focus()
}

// The sticky action bar (Znam / Dalje / Nova sesija) takes the tab bar's place while a session runs and at its end.
useHidePzTabBar(() => ready.value && !unavailable.value && !error.value && !!(reviewShown.value || currentCard.value || finished.value), 'game')

const card = useTemplateRef<{ focus: () => void }>('card')

const running = computed(() => ready.value && !unavailable.value && !error.value && !!(reviewShown.value || (currentCard.value && active.value)))
const roundTitle = computed(() => active.value?.mode === 'review' || reviewShown.value ? 'Ponavljanje' : 'Učenje')
const rated = computed(() => Object.keys(shownSession.value?.results ?? {}).length)
const exitCopy = computed(() => ({
  label: 'Izađi iz učenja',
  title: 'Želiš li završiti za danas?',
  description: `${rated.value === 0 ? 'Još nijedna kartica nije ocijenjena.' : `Ocijenjene kartice (${rated.value}) ostaju spremljene.`} Preostale čekat će te sljedeći put.`,
  stay: 'Nastavi učiti',
  leave: 'Završi'
}))

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
  <div>
    <template v-if="running">
      <RoundBar
        :title="roundTitle"
        :current="Math.max(counter.i, 1)"
        :total="Math.max(counter.n, 1)"
        :exit-to="pzRoutes.learn"
        :exit="exitCopy"
      />
      <UContainer class="py-4 lg:py-6">
        <div
          class="mx-auto flex w-full max-w-(--pz-game-col) flex-col gap-4"
          data-testid="learn-runner"
        >
          <h1 class="sr-only">
            {{ t('pz.learn.title') }}
          </h1>
          <p
            class="pz-overline text-muted"
            data-testid="learn-counter"
          >
            <span aria-hidden="true">Kartica {{ counter.i }} od {{ counter.n }}<template v-if="!reviewShown && currentCard?.kind === 'word'"> · Što znači?</template></span>
            <span class="sr-only">{{ t('pz.learn.counter', { i: counter.i, n: counter.n }) }}</span>
          </p>
          <LearnReviewCard
            v-if="reviewShown"
            :key="`${reviewShown.key}-${reviewStep}`"
            :card="reviewShown.card"
            :pool="pool"
            :question="reviewShown.question"
            :last="finished !== null"
            @answer="scoreReview"
            @next="reviewNext"
          />
          <LearnCard
            v-else-if="currentCard"
            :key="currentKey"
            ref="card"
            v-model:flipped="flipped"
            :card="currentCard"
            :pool="pool"
            :place-slug="placeSlug"
          />
        </div>
      </UContainer>
      <ActionBar v-if="!reviewShown">
        <div class="grid w-full grid-cols-2 gap-3">
          <UButton
            v-if="!seen"
            class="col-span-2"
            label="Pokaži značenje"
            size="xl"
            block
            data-testid="learn-reveal"
            @click="flipped = true"
          />
          <template v-else>
            <UButton
              label="Još ne znam"
              color="neutral"
              variant="outline"
              size="xl"
              block
              data-testid="learn-unknown"
              @click="grade(false)"
            />
            <UButton
              :label="t('pz.learn.known')"
              size="xl"
              block
              data-testid="learn-known"
              @click="grade(true)"
            />
          </template>
        </div>
      </ActionBar>
    </template>

    <UContainer
      v-else
      class="py-4 lg:py-6"
    >
      <div class="mx-auto flex w-full max-w-(--pz-game-col) flex-col gap-4">
        <PzBackPill :to="localePath(pzRoutes.learn)">
          {{ t('pz.learn.title') }}
        </PzBackPill>

        <div
          v-if="!ready || status === 'pending'"
          class="space-y-3"
          aria-busy="true"
        >
          <p
            class="sr-only"
            role="status"
          >
            Pripremamo kartice…
          </p>
          <USkeleton class="h-72 w-full rounded-(--pz-radius-lg)" />
        </div>

        <PageState
          v-else-if="error"
          kind="error"
          title="Kartice nismo uspjeli učitati"
          description="Tvoj je napredak sačuvan. Pokušaj ponovno."
          @retry="refresh()"
        />

        <div
          v-else-if="unavailable"
          class="rounded-(--pz-radius-lg) border border-default bg-default p-6"
          data-testid="learn-unavailable"
        >
          <p class="pz-body text-highlighted">
            {{ t('pz.learn.sessionUnavailable') }}
          </p>
          <UButton
            :to="localePath(pzRoutes.learn)"
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
      </div>
    </UContainer>
  </div>
</template>
