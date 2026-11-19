<script setup lang="ts">
import { gameDefinition } from '~~/shared/utils/games/definitions'
import { mulberry32 } from '~~/shared/utils/games/rng'
import { pickPlaceTarget } from '~~/shared/utils/games/distractors'
import { distanceKm, distanceScore, project } from '~~/shared/utils/games/mapFrame'
import type { Difficulty } from '~~/shared/utils/games/types'
import type { PoolPlace } from '~~/shared/utils/learn/types'

const ROUND_LENGTH = 10

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const game = gameDefinition('karta')

const { t } = useI18n()
const localePath = useLocalePath()
const { pool, status, error, refresh } = useCardPool()
const { recordBest } = useGameScores()

const seed = useState('heritage-karta-seed', () => Math.floor(Math.random() * 4294967296))
const difficulty = ref<Difficulty>('srednje')
const started = ref(false)
const index = ref(0)
const totalScore = ref(0)
const roundPlaces = shallowRef<PoolPlace[]>([])
const answered = ref(false)
const results = ref<boolean[]>([])
const feedbackPanel = useTemplateRef<{ focus: () => void }>('feedbackPanel')
const feedback = ref<{ tap: { x: number, y: number }, target: { x: number, y: number }, km?: number, correct: boolean, points: number } | null>(null)

const places = computed(() => pool.value.cards.filter((c): c is PoolPlace => c.kind === 'place'))
const municipalities = computed(() => pool.value.municipalities)
const loading = computed(() => !error.value && (status.value === 'idle' || status.value === 'pending'))
const target = computed(() => roundPlaces.value[index.value])
const finished = computed(() => started.value && index.value >= roundPlaces.value.length)

// Dalje owns the bottom of the screen while a round is in play, so the tab bar steps aside.
useHidePzTabBar(() => started.value && !finished.value, 'game')

function buildRound() {
  const rng = mulberry32(seed.value)
  const list = places.value
  const picks: PoolPlace[] = []
  const used = new Set<string>()
  for (let i = 0; i < ROUND_LENGTH && picks.length < list.length; i++) {
    const rest = list.filter(p => !used.has(p.id))
    const next = pickPlaceTarget(rest, difficulty.value, rng)
    if (!next) break
    used.add(next.id)
    picks.push(next)
  }
  return picks
}

function start() {
  roundPlaces.value = buildRound()
  index.value = 0
  totalScore.value = 0
  results.value = []
  answered.value = false
  feedback.value = null
  started.value = roundPlaces.value.length > 0
}

function restart() {
  seed.value = (seed.value + 1) >>> 0
  start()
}

async function onPick(payload: { placeId?: string, lat: number, lng: number, imageX: number, imageY: number }) {
  const current = target.value
  if (!current || answered.value) return
  const targetPt = project(current.lat, current.lng)
  let points = 0
  let correct = false
  let km: number | undefined
  if (difficulty.value === 'tesko') {
    km = distanceKm({ lat: payload.lat, lng: payload.lng }, { lat: current.lat, lng: current.lng })
    points = distanceScore(km)
    correct = points >= 900
  } else {
    correct = payload.placeId === current.id
    points = correct ? 100 : 0
  }
  totalScore.value += points
  answered.value = true
  feedback.value = {
    tap: { x: payload.imageX, y: payload.imageY },
    target: targetPt,
    km,
    correct,
    points
  }
  results.value = [...results.value, correct]
  await nextTick()
  feedbackPanel.value?.focus()
}

function nextQuestion() {
  index.value += 1
  answered.value = false
  feedback.value = null
  if (finished.value) {
    const max = difficulty.value === 'tesko' ? ROUND_LENGTH * 1000 : ROUND_LENGTH * 100
    recordBest(game.id, totalScore.value, max)
  }
}

useSeoMeta({
  title: () => t('pz.map.findTitle'),
  description: () => t('pz.map.findBlurb')
})
</script>

<template>
  <UContainer class="py-3 sm:py-5 lg:py-6">
    <div class="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-3">
      <PageHead
        v-if="!started || loading || error"
        :title="t('pz.map.findTitle')"
        :lead="t('pz.map.findBlurb')"
      />

      <div
        v-if="error || loading"
        class="rounded-xl bg-default p-4 ring ring-default"
        role="status"
      >
        <p>{{ t(error ? 'quiz.loadError' : 'quiz.loading') }}</p>
        <UButton
          v-if="error"
          :label="t('quiz.retry')"
          variant="link"
          @click="refresh()"
        />
      </div>

      <GamesStart
        v-else-if="!started"
        v-model:difficulty="difficulty"
        :game-id="game.id"
        :questions="ROUND_LENGTH"
        :instructions="['Dodirni kartu da postaviš oznaku.', 'Pritisni „Dalje” kad pročitaš rezultat.']"
        :disabled="!places.length"
        @start="start"
      />

      <template v-else-if="!finished && target">
        <RoundBar
          :title="t('pz.map.findTitle')"
          :current="index + 1"
          :total="roundPlaces.length"
          :score="totalScore"
        />
        <h2
          class="pz-h2 text-highlighted"
          data-testid="map-find-prompt"
        >
          {{ t('pz.map.whereIs', { name: target.name }) }}
        </h2>
        <GamesMapView
          :places="places"
          :municipalities="municipalities"
          :difficulty="difficulty"
          mode="find"
          :feedback="feedback ? { tap: feedback.tap, target: feedback.target, km: feedback.km } : null"
          :disabled="answered"
          data-testid="map-find-view"
          @pick="onPick"
        />
        <template v-if="answered && feedback">
          <GamesFeedback
            ref="feedbackPanel"
            :correct="feedback.correct"
            :answer="target.name"
            :explanation="feedback.km !== undefined ? t('pz.map.kmFromTarget', { km: feedback.km.toLocaleString('hr-HR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }) : undefined"
            lang="hr"
            data-testid="map-find-feedback"
          >
            <template #links>
              <UButton
                :to="localePath(settlementArchivePath(pool, target))"
                :label="t('pz.play.openRecord')"
                icon="i-lucide-map-pin"
                color="neutral"
                variant="link"
                class="min-h-(--pz-tap-min) px-0 font-semibold"
              />
            </template>
          </GamesFeedback>
          <GamesDalje
            testid="map-find-next"
            :last="index + 1 >= roundPlaces.length"
            @next="nextQuestion"
          />
        </template>
      </template>

      <div
        v-else
        class="rounded-xl bg-default p-4 text-center ring ring-default"
      >
        <p class="text-lg font-bold text-highlighted">
          {{ t('pz.play.done') }}
        </p>
        <p class="mt-1 text-muted">
          {{ t('pz.play.score', { score: totalScore }) }}
        </p>
        <UButton
          class="mt-3"
          block
          :label="t('pz.play.again')"
          @click="restart"
        />
      </div>
    </div>
  </UContainer>
</template>
