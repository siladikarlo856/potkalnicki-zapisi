<script setup lang="ts">
import type { ChallengeSetPublic, ChallengeState, GenerateChallengeInput } from '~~/shared/utils/challenge'
import type { TopicId } from '~~/shared/utils/learn/types'
import type { Difficulty, GenerateGameId } from '~~/shared/utils/games/types'
import { applyChallengeCreateQuery, challengeCreateGameEnabled, defaultChallengeCreateForm } from '~~/shared/utils/challengeCreateForm'
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { pool, status: poolStatus } = useCardPool()

useSeoMeta({ title: () => t('challenge.createPageTitle'), description: () => t('challenge.createPageIntro') })

const { data: publishedSets } = await useFetch<ChallengeSetPublic[]>('/api/challenges/sets', { default: () => [] })
const showSetSource = computed(() => publishedSets.value.some(set => !set.sample))

const source = ref<'random' | 'set' | 'quiz'>('random')
const selectedSetId = ref<string | null>(null)
const form = ref(defaultChallengeCreateForm())
const selectedTopics = computed({
  get: () => form.value.topics,
  set: (topics: TopicId[]) => { form.value = { ...form.value, topics } }
})
const game = computed({
  get: () => form.value.game,
  set: (value: GenerateGameId) => { form.value = { ...form.value, game: value } }
})
const difficulty = computed({
  get: () => form.value.difficulty,
  set: (value: Difficulty) => { form.value = { ...form.value, difficulty: value } }
})
const length = computed({
  get: () => form.value.length,
  set: (value: GenerateChallengeInput['length']) => { form.value = { ...form.value, length: value } }
})
const nickname = ref('')
const busy = ref(false)
const error = ref('')
const { remember } = useChallengeList()

const liveTopics = computed(() => pool.value.topics.filter(topic => topic.status === 'live' && topic.count > 0))

const gameOptions = computed(() => ([
  { id: 'mjesovito' as const, label: t('challenge.gameMixed') },
  { id: 'znacenje' as const, label: t('challenge.gameMeaning') },
  { id: 'rijec' as const, label: t('challenge.gameWord') },
  { id: 'opcina' as const, label: t('challenge.gameMunicipality') },
  { id: 'crkva' as const, label: t('challenge.gameChurch') }
]))

function gameEnabled(id: GenerateGameId) {
  return challengeCreateGameEnabled(id, selectedTopics.value, pool.value)
}

watch([selectedTopics, pool], () => {
  if (!gameEnabled(game.value)) {
    const fallback = gameOptions.value.find(option => gameEnabled(option.id))
    if (fallback) game.value = fallback.id
  }
}, { deep: true })

function toggleTopic(id: TopicId) {
  const next = selectedTopics.value.includes(id)
    ? selectedTopics.value.filter(topic => topic !== id)
    : [...selectedTopics.value, id]
  if (next.length) selectedTopics.value = next
}

function syncQueryPrefill() {
  const live = new Set(liveTopics.value.map(topic => topic.id))
  form.value = applyChallengeCreateQuery(route.query, live, form.value)
}

watch(() => [poolStatus.value, route.query.teme, route.query.igra, route.query.tezina, route.query.n] as const, ([status]) => {
  if (status === 'success') syncQueryPrefill()
}, { immediate: true })

const generateBody = computed(() => ({
  topics: form.value.topics,
  game: form.value.game,
  difficulty: form.value.difficulty,
  length: form.value.length
} satisfies GenerateChallengeInput))

async function submit() {
  const name = challengeNickname(nickname.value)
  if (!name) {
    error.value = t('challenge.invalidNickname')
    return
  }
  if (source.value === 'set') {
    if (!selectedSetId.value) {
      error.value = t('challenge.sourceSetEmpty')
      return
    }
  } else if (!gameEnabled(game.value)) {
    error.value = t('challenge.createInvalidGame')
    return
  }
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const body = source.value === 'set'
      ? { nickname: name, set: selectedSetId.value! }
      : { nickname: name, generate: generateBody.value }
    const state = await $fetch<ChallengeState>('/api/challenges', {
      method: 'POST',
      body
    })
    remember(state, 'creator')
    await navigateTo(localePath(`/potkalnicko-prigorje/izazov/${state.code}`))
  } catch (cause) {
    const failure = cause as { status?: number, statusCode?: number }
    error.value = (failure.status ?? failure.statusCode) === 429 ? t('challenge.limited') : t('challenge.createError')
  } finally {
    busy.value = false
  }
}

watch(publishedSets, (sets) => {
  if (selectedSetId.value && !sets.some(set => set.id === selectedSetId.value)) selectedSetId.value = null
  if (source.value === 'set' && !showSetSource.value) source.value = 'random'
}, { immediate: true })
</script>

<template>
  <UContainer class="max-w-3xl space-y-8 py-10 sm:py-16">
    <UButton
      :to="localePath(pzRoutes.challenge)"
      color="neutral"
      variant="link"
      icon="i-lucide-arrow-left"
    >
      {{ t('challenge.backToHub') }}
    </UButton>

    <header class="space-y-2">
      <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
        {{ t('challenge.createPageTitle') }}
      </h1>
      <p class="text-lg text-muted">
        {{ t('challenge.createPageIntro') }}
      </p>
    </header>

    <form
      class="space-y-8"
      data-testid="challenge-create-form"
      @submit.prevent="submit"
    >
      <section class="space-y-3">
        <h2 class="text-lg font-semibold">
          {{ t('challenge.sourceLabel') }}
        </h2>
        <div
          class="flex flex-wrap gap-2"
          role="group"
          :aria-label="t('challenge.sourceLabel')"
        >
          <UButton
            type="button"
            :color="source === 'random' ? 'primary' : 'neutral'"
            :variant="source === 'random' ? 'solid' : 'outline'"
            data-testid="challenge-source-random"
            @click="source = 'random'"
          >
            {{ t('challenge.sourceRandom') }}
          </UButton>
          <UButton
            v-if="showSetSource"
            type="button"
            :color="source === 'set' ? 'primary' : 'neutral'"
            :variant="source === 'set' ? 'solid' : 'outline'"
            data-testid="challenge-source-set"
            @click="source = 'set'"
          >
            {{ t('challenge.sourceSet') }}
          </UButton>
          <UButton
            type="button"
            :color="source === 'quiz' ? 'primary' : 'neutral'"
            :variant="source === 'quiz' ? 'solid' : 'outline'"
            data-testid="challenge-source-quiz"
            @click="source = 'quiz'"
          >
            {{ t('challenge.sourceQuizRound') }}
          </UButton>
        </div>
        <UCard
          v-if="source === 'quiz'"
          class="space-y-3"
        >
          <p class="text-sm text-muted">
            {{ t('challenge.sourceQuizHelp') }}
          </p>
          <UButton
            :to="localePath(pzRoutes.quiz)"
            color="neutral"
            variant="outline"
            icon="i-lucide-sparkles"
          >
            {{ t('challenge.sourceQuizCta') }}
          </UButton>
        </UCard>
      </section>

      <template v-if="source === 'set'">
        <section class="space-y-3">
          <p class="text-sm text-muted">
            {{ t('challenge.sourceSetHelp') }}
          </p>
          <div
            class="grid gap-3 sm:grid-cols-2"
            role="listbox"
            :aria-label="t('challenge.sourceSet')"
          >
            <button
              v-for="set in publishedSets"
              :key="set.id"
              type="button"
              role="option"
              :aria-selected="selectedSetId === set.id"
              class="rounded-lg border p-4 text-left transition-colors"
              :class="selectedSetId === set.id ? 'border-primary bg-primary/5' : 'border-default hover:border-primary/40'"
              :data-set-id="set.id"
              @click="selectedSetId = set.id"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-semibold">{{ set.title.hr }}</span>
                <UBadge
                  v-if="set.sample"
                  :label="t('challenge.sourceSetSampleBadge')"
                  color="warning"
                  variant="subtle"
                  size="sm"
                />
              </div>
              <p class="mt-1 text-sm text-muted">
                {{ set.rounds.map(r => `${r.topic.hr} (${r.count})`).join(' · ') }}
              </p>
            </button>
          </div>
        </section>

        <UFormField
          :label="t('challenge.nickname')"
          :help="t('challenge.nicknameHelp')"
          required
        >
          <UInput
            v-model="nickname"
            name="nickname"
            autocomplete="nickname"
            :maxlength="24"
            class="w-full"
            data-testid="challenge-create-nickname"
          />
        </UFormField>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :description="error"
          role="alert"
        />

        <UButton
          type="submit"
          size="lg"
          icon="i-lucide-swords"
          :loading="busy"
          :disabled="!selectedSetId"
          data-testid="challenge-create-submit"
        >
          {{ t('challenge.createPageSubmit') }}
        </UButton>
      </template>

      <template v-else-if="source === 'random'">
        <section class="space-y-3">
          <h2 class="text-lg font-semibold">
            {{ t('challenge.topicsLabel') }}
          </h2>
          <div
            class="flex flex-wrap gap-2"
            role="group"
            :aria-label="t('challenge.topicsLabel')"
          >
            <UButton
              v-for="topic in liveTopics"
              :key="topic.id"
              type="button"
              size="sm"
              :color="selectedTopics.includes(topic.id) ? 'primary' : 'neutral'"
              :variant="selectedTopics.includes(topic.id) ? 'solid' : 'outline'"
              :data-topic="topic.id"
              @click="toggleTopic(topic.id)"
            >
              {{ topic.label }}
            </UButton>
          </div>
        </section>

        <section class="space-y-3">
          <h2 class="text-lg font-semibold">
            {{ t('challenge.gameLabel') }}
          </h2>
          <div
            class="grid gap-2 sm:grid-cols-2"
            role="group"
            :aria-label="t('challenge.gameLabel')"
          >
            <UButton
              v-for="option in gameOptions"
              :key="option.id"
              type="button"
              :color="game === option.id ? 'primary' : 'neutral'"
              :variant="game === option.id ? 'solid' : 'outline'"
              :disabled="!gameEnabled(option.id)"
              :data-game="option.id"
              class="justify-start whitespace-normal text-left"
              @click="game = option.id"
            >
              {{ option.label }}
            </UButton>
          </div>
        </section>

        <section class="space-y-3">
          <h2 class="text-lg font-semibold">
            {{ t('challenge.difficultyLabel') }}
          </h2>
          <div
            class="flex flex-wrap gap-2"
            role="group"
            :aria-label="t('challenge.difficultyLabel')"
          >
            <UButton
              v-for="level in (['lako', 'srednje', 'tesko'] as const)"
              :key="level"
              type="button"
              :color="difficulty === level ? 'primary' : 'neutral'"
              :variant="difficulty === level ? 'solid' : 'outline'"
              :data-difficulty="level"
              @click="difficulty = level"
            >
              {{ t(`challenge.difficulty.${level}`) }}
            </UButton>
          </div>
        </section>

        <section class="space-y-3">
          <h2 class="text-lg font-semibold">
            {{ t('challenge.lengthLabel') }}
          </h2>
          <div
            class="flex flex-wrap gap-2"
            role="group"
            :aria-label="t('challenge.lengthLabel')"
          >
            <UButton
              v-for="count in ([5, 10, 15] as const)"
              :key="count"
              type="button"
              :color="length === count ? 'primary' : 'neutral'"
              :variant="length === count ? 'solid' : 'outline'"
              :data-length="count"
              @click="length = count"
            >
              {{ count }}
            </UButton>
          </div>
        </section>

        <UFormField
          :label="t('challenge.nickname')"
          :help="t('challenge.nicknameHelp')"
          required
        >
          <UInput
            v-model="nickname"
            name="nickname"
            autocomplete="nickname"
            :maxlength="24"
            class="w-full"
            data-testid="challenge-create-nickname"
          />
        </UFormField>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :description="error"
          role="alert"
        />

        <UButton
          type="submit"
          size="lg"
          icon="i-lucide-swords"
          :loading="busy"
          data-testid="challenge-create-submit"
        >
          {{ t('challenge.createPageSubmit') }}
        </UButton>
      </template>
    </form>
  </UContainer>
</template>
