<script setup lang="ts">
import type { ChallengeSetPublic, ChallengeState, GenerateChallengeInput } from '~~/shared/utils/challenge'
import type { TopicId } from '~~/shared/utils/learn/types'
import type { GenerateGameId } from '~~/shared/utils/games/types'
import { applyChallengeCreateQuery, challengeCreateGameEnabled, challengeCreateGameOptions, defaultChallengeCreateForm } from '~~/shared/utils/challengeCreateForm'
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { pool, status: poolStatus } = useCardPool()
useSeoMeta({ title: () => t('challenge.newPageTitle'), description: () => t('challenge.newPageIntro') })

const { data: publishedSets } = await useFetch<ChallengeSetPublic[]>('/api/challenges/sets', { default: () => [] })
const showSetSource = computed(() => publishedSets.value.some(set => !set.sample))
const source = ref<'random' | 'set' | 'quiz'>('random')
const selectedSetId = ref<string | null>(null)
const form = ref({ ...defaultChallengeCreateForm(), game: 'znacenje' as GenerateGameId, topics: ['rijeci'] as TopicId[] })
const nickname = ref('')
const busy = ref(false)
const error = ref('')
const { remember } = useChallengeList()

const selectedTopics = computed({
  get: () => form.value.topics,
  set: (topics: TopicId[]) => { form.value = { ...form.value, topics } }
})
const game = computed({
  get: () => form.value.game,
  set: (value: GenerateGameId) => { form.value = { ...form.value, game: value } }
})
const length = computed({
  get: () => form.value.length,
  set: (value: GenerateChallengeInput['length']) => { form.value = { ...form.value, length: value } }
})

const liveTopics = computed(() => pool.value.topics.filter(topic => topic.status === 'live' && topic.count > 0))
const gameOptions = challengeCreateGameOptions('hr')
const gameChoices = computed(() => gameOptions.filter(option => ['znacenje', 'karta-koje', 'rijec'].includes(option.id)))
const gameDescription: Record<string, string> = { 'znacenje': 'Izbor odgovora', 'karta-koje': 'Karta', 'rijec': 'Pogodi riječ' }

function gameEnabled(id: GenerateGameId) {
  return challengeCreateGameEnabled(id, selectedTopics.value, pool.value)
}

function chooseGame(id: GenerateGameId) {
  source.value = 'random'
  game.value = id
  selectedTopics.value = id === 'karta-koje' ? ['mjesta'] : ['rijeci']
}

watch([selectedTopics, pool], () => {
  if (!gameEnabled(game.value)) {
    const fallback = gameChoices.value.find(option => gameEnabled(option.id))
    if (fallback) chooseGame(fallback.id)
  }
}, { deep: true })

function syncQueryPrefill() {
  const live = new Set(liveTopics.value.map(topic => topic.id))
  form.value = applyChallengeCreateQuery(route.query, live, form.value)
}
watch(() => [poolStatus.value, route.query.teme, route.query.igra, route.query.tezina, route.query.n] as const, ([status]) => {
  if (status === 'success') syncQueryPrefill()
}, { immediate: true })

const generateBody = computed(() => ({ topics: form.value.topics, game: form.value.game, difficulty: form.value.difficulty, length: form.value.length } satisfies GenerateChallengeInput))

async function submit() {
  const name = challengeNickname(nickname.value)
  if (!name) {
    error.value = t('challenge.nicknameRequired')
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
    const body = source.value === 'set' ? { nickname: name, set: selectedSetId.value! } : { nickname: name, generate: generateBody.value }
    const state = await $fetch<ChallengeState>('/api/challenges', { method: 'POST', body })
    remember(state, 'creator')
    await navigateTo(localePath(pzPath(pzRoutes.challenge, state.code)))
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
  <UContainer class="max-w-3xl py-6 sm:py-10">
    <UButton
      :to="localePath(pzRoutes.challenge)"
      color="neutral"
      variant="link"
      icon="i-lucide-arrow-left"
      class="mb-6 min-h-(--pz-tap-min)"
    >
      {{ t('challenge.backToHub') }}
    </UButton>

    <header class="flex flex-col gap-3">
      <h1 class="pz-h1 text-highlighted">
        {{ t('challenge.newPageTitle') }}
      </h1>
      <p class="pz-lead text-muted">
        {{ t('challenge.newPageIntro') }}
      </p>
    </header>

    <form
      class="mt-8 space-y-8 pb-24"
      data-testid="challenge-create-form"
      @submit.prevent="submit"
    >
      <fieldset class="space-y-3">
        <legend class="pz-h3 text-highlighted">
          {{ t('challenge.gameLabel') }}
        </legend>
        <div class="grid gap-3 sm:grid-cols-2">
          <label
            v-for="option in gameChoices"
            :key="option.id"
            class="flex min-h-16 cursor-pointer items-start gap-3 rounded-(--pz-radius-md) border p-4 transition-colors"
            :class="game === option.id ? 'border-2 border-primary bg-accented' : 'border-default hover:border-primary'"
            :data-game="option.id"
          >
            <input
              name="game"
              type="radio"
              class="mt-1 size-4 accent-(--pz-primary)"
              :value="option.id"
              :checked="game === option.id"
              :disabled="!gameEnabled(option.id)"
              @change="chooseGame(option.id)"
            >
            <span class="min-w-0">
              <b class="block text-highlighted">{{ option.label }}</b>
              <small class="text-muted">{{ gameDescription[option.id] }}</small>
            </span>
          </label>
          <label
            v-if="showSetSource"
            class="flex min-h-16 cursor-pointer items-start gap-3 rounded-(--pz-radius-md) border p-4 transition-colors"
            :class="source === 'set' ? 'border-2 border-primary bg-accented' : 'border-default hover:border-primary'"
            data-testid="challenge-source-set"
          >
            <input
              name="game"
              type="radio"
              class="mt-1 size-4 accent-(--pz-primary)"
              :checked="source === 'set'"
              @change="source = 'set'"
            >
            <span class="min-w-0">
              <b class="block text-highlighted">{{ t('challenge.sourceSet') }}</b>
              <small class="text-muted">{{ t('challenge.sourceSetHelp') }}</small>
            </span>
          </label>
        </div>
        <NuxtLink
          :to="localePath(pzRoutes.games)"
          class="text-sm font-semibold text-primary underline"
        >
          {{ t('challenge.allGames') }}
        </NuxtLink>
      </fieldset>

      <section
        v-if="source === 'set'"
        class="space-y-3"
      >
        <h2 class="pz-h3 text-highlighted">
          {{ t('challenge.sourceSet') }}
        </h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <button
            v-for="set in publishedSets"
            :key="set.id"
            type="button"
            class="rounded-(--pz-radius-md) border p-4 text-left"
            :class="selectedSetId === set.id ? 'border-2 border-primary bg-accented' : 'border-default'"
            :aria-pressed="selectedSetId === set.id"
            :data-set-id="set.id"
            @click="selectedSetId = set.id"
          >
            <span class="font-semibold text-highlighted">{{ set.title.hr }}</span>
            <span class="mt-1 block text-sm text-muted">{{ set.rounds.map(r => `${r.topic.hr} (${r.count})`).join(' · ') }}</span>
          </button>
        </div>
      </section>

      <section
        v-else
        class="space-y-3"
      >
        <h2 class="pz-h3 text-highlighted">
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
            :aria-pressed="length === count"
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
        :error="error || undefined"
        required
      >
        <UInput
          v-model="nickname"
          name="nickname"
          autocomplete="nickname"
          :maxlength="24"
          size="xl"
          class="w-full"
          data-testid="challenge-create-nickname"
        />
      </UFormField>

      <UAlert
        v-if="error && source === 'set'"
        color="error"
        variant="subtle"
        :description="error"
        role="alert"
      />

      <div class="sticky bottom-0 z-20 -mx-4 flex items-center border-t border-accented bg-default px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
        <UButton
          type="submit"
          size="xl"
          block
          icon="i-lucide-swords"
          :loading="busy"
          :disabled="source === 'set' && !selectedSetId"
          data-testid="challenge-create-submit"
        >
          {{ t('challenge.createPageSubmit') }}
        </UButton>
      </div>
    </form>
  </UContainer>
</template>
