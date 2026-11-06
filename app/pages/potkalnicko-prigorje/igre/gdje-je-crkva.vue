<script setup lang="ts">
import { mulberry32 } from '~~/shared/utils/games/rng'
import { generateQuestions } from '~~/shared/utils/games/questions'
import { slugMap } from '~~/shared/utils/games/distractors'
import { cardMatchesTopicSelection, topicDef } from '~~/shared/utils/learn/topics'
import type { Difficulty, GameQuestion } from '~~/shared/utils/games/types'
import type { CardKey, PoolItem, TopicId } from '~~/shared/utils/learn/types'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const GAME_LENGTH = 10
const { t } = useI18n()
const { pool, status, error, refresh } = useCardPool()
const seed = useState('heritage-gdje-crkva-seed', () => Math.floor(Math.random() * 4294967296))
const difficulty = ref<Difficulty>('srednje')
const topicScope = ref<'narrow' | 'wide'>('narrow')
const questions = shallowRef<GameQuestion[]>([])
const started = ref(false)
const loading = computed(() => !error.value && (status.value === 'idle' || status.value === 'pending'))

const topics = computed<TopicId[]>(() => topicScope.value === 'narrow' ? ['bastina-crkve'] : ['bastina'])

const itemCount = computed(() => {
  const slugs = slugMap(pool.value)
  return pool.value.cards.filter(c => c.kind === 'item' && cardMatchesTopicSelection(c, topics.value, slugs)).length
})

const hasItems = computed(() => itemCount.value >= 1)

function poolItem(key: CardKey): PoolItem | undefined {
  const card = pool.value.cards.find(c => c.key === key)
  return card?.kind === 'item' ? card : undefined
}

function newRound() {
  return generateQuestions('crkva', pool.value, {
    topics: topics.value,
    difficulty: difficulty.value,
    count: GAME_LENGTH,
    rng: mulberry32(seed.value)
  })
}

function start() {
  questions.value = newRound()
  started.value = questions.value.length > 0
}

function restart() {
  seed.value = (seed.value + 1) >>> 0
  questions.value = newRound()
}

watch(topics, () => {
  if (started.value) restart()
})

useSeoMeta({
  title: () => t('pz.play.churchTitle'),
  ogTitle: () => `${t('pz.play.churchTitle')} · Potkalnički zapisi`,
  ogDescription: () => t('pz.play.churchDescription'),
  description: () => t('pz.play.churchDescription')
})
</script>

<template>
  <UContainer class="py-3 sm:py-5 lg:py-6">
    <div class="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-3">
      <header>
        <p class="mb-1 text-xs font-semibold text-primary">
          {{ t('pz.play.churchEyebrow') }}
        </p>
        <h1 class="text-2xl font-bold tracking-tight text-highlighted sm:text-3xl">
          {{ t('pz.play.churchTitle') }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ t('pz.play.churchDescription') }}
        </p>
      </header>

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
      <div
        v-else-if="!hasItems"
        class="rounded-xl bg-default p-4 text-center ring ring-default"
        role="status"
      >
        <h2 class="text-xl font-bold text-highlighted">
          {{ t('quiz.emptyTitle') }}
        </h2>
        <p class="mt-1 text-sm text-muted">
          {{ t('pz.play.emptyBastina') }}
        </p>
      </div>
      <template v-else-if="!started">
        <div
          class="flex flex-col gap-2 rounded-xl bg-default p-4 ring ring-default sm:p-5"
          data-testid="church-topic-picker"
        >
          <p class="text-sm font-semibold text-highlighted">
            {{ t('pz.play.churchTopicLabel') }}
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              size="sm"
              :color="topicScope === 'narrow' ? 'primary' : 'neutral'"
              :variant="topicScope === 'narrow' ? 'solid' : 'outline'"
              data-testid="church-topic-narrow"
              @click="topicScope = 'narrow'"
            >
              {{ topicDef('bastina-crkve')?.label ?? 'Crkve i kapele' }}
            </UButton>
            <UButton
              size="sm"
              :color="topicScope === 'wide' ? 'primary' : 'neutral'"
              :variant="topicScope === 'wide' ? 'solid' : 'outline'"
              data-testid="church-topic-wide"
              @click="topicScope = 'wide'"
            >
              {{ topicDef('bastina')?.label ?? 'Baština' }}
            </UButton>
          </div>
          <p class="text-xs text-muted">
            {{ t('pz.play.churchTopicCount', { count: itemCount }) }}
          </p>
        </div>
        <GamesStart
          v-model:difficulty="difficulty"
          @start="start"
        />
      </template>
      <GamesShell
        v-else
        game-id="crkva"
        :title="t('pz.play.churchTitle')"
        :questions="questions"
        :topics="topics"
        :difficulty="difficulty"
        @restart="restart"
      >
        <template #default="{ question, selected, answer }">
          <div class="mb-3 flex justify-center">
            <PzVerificationBadge
              :verification="poolItem(question.card)?.verification"
              data-testid="church-status-badge"
            />
          </div>
          <GamesOptions
            :question="question"
            :selected="selected"
            labelledby="game-question"
            @select="answer"
          />
        </template>
      </GamesShell>
    </div>
  </UContainer>
</template>
