<script setup lang="ts">
import type { ChallengeState, ChallengeText } from '../../../shared/utils/challenge'

const props = defineProps<{ code?: string }>()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const state = ref<ChallengeState | null>(null)
const overview = ref<{ title: ChallengeText, sample: boolean, rounds: { topic: ChallengeText, count: number }[], maxScore: number } | null>(null)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const entering = ref(false)
const nickname = ref('')
const text = (value: ChallengeText) => value[locale.value === 'en' ? 'en' : 'hr']
const participant = computed(() => state.value?.participant)
const question = computed(() => state.value?.question)
const feedback = computed(() => state.value?.feedback)
const details = computed(() => state.value ?? overview.value)
const closed = computed(() => state.value?.closed && !participant.value?.completedAt)
const readyRound = computed(() => {
  let remaining = participant.value?.index ?? 0
  for (const [index, round] of (state.value?.rounds ?? []).entries()) {
    if (remaining < round.count) return index
    remaining -= round.count
  }
  return 0
})
const date = computed(() => state.value ? new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'hr-HR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(state.value.closesAt)) : '')

function message(cause: unknown) {
  const e = cause as { status?: number, statusCode?: number, data?: { statusMessage?: string } }
  if (e.data?.statusMessage === 'Nickname taken') return t('challenge.taken')
  if ((e.status ?? e.statusCode) === 429) return t('challenge.limited')
  if ((e.status ?? e.statusCode) === 409) return t('challenge.changed')
  return t('challenge.error')
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    if (props.code) state.value = await $fetch<ChallengeState>(`/api/challenges/${props.code}`)
    else overview.value = await $fetch('/api/challenges/template')
  } catch {
    error.value = t('challenge.unavailable')
  } finally {
    loading.value = false
  }
}

async function act(action: 'create' | 'join' | 'reveal' | 'answer' | 'continue', body: Record<string, unknown> = {}) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const path = action === 'create' ? '/api/challenges' : `/api/challenges/${props.code}/${action}`
    state.value = await $fetch<ChallengeState>(path, { method: 'POST', body })
    if (action === 'create') await navigateTo(localePath(`/heritage/challenge/${state.value.code}`))
    entering.value = false
  } catch (cause) {
    error.value = message(cause)
    // The answer may have reached the server even when its response was lost.
    if (props.code) {
      try {
        state.value = await $fetch<ChallengeState>(`/api/challenges/${props.code}`)
      } catch { /* Keep the last confirmed state and retry control. */ }
    }
  } finally {
    busy.value = false
  }
}

async function enter() {
  const name = challengeNickname(nickname.value)
  if (!name) {
    error.value = t('challenge.invalidNickname')
    return
  }
  await act(props.code ? 'join' : 'create', { nickname: name })
}

async function advance() {
  if (!participant.value) return
  await act('continue', { phase: participant.value.phase, index: participant.value.index })
  if (!error.value && participant.value?.phase === 'ready' && !state.value?.closed) await act('reveal')
}

onMounted(() => {
  void load()
})
</script>

<template>
  <UContainer class="max-w-3xl py-10 sm:py-16">
    <UButton
      :to="localePath('/heritage')"
      color="neutral"
      variant="link"
      icon="i-lucide-arrow-left"
      class="mb-6"
    >
      {{ t('challenge.heritage') }}
    </UButton>

    <p
      v-if="loading"
      role="status"
    >
      {{ t('challenge.loading') }}
    </p>
    <div
      v-else
      class="space-y-6"
    >
      <header class="space-y-3">
        <UBadge
          v-if="details?.sample"
          color="warning"
          variant="subtle"
        >
          {{ t('challenge.sample') }}
        </UBadge>
        <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
          {{ props.code && details ? text(details.title) : t('challenge.newTitle') }}
        </h1>
        <p
          v-if="!participant"
          class="text-lg text-muted"
        >
          {{ t(props.code ? 'challenge.intro' : 'challenge.newIntro') }}
        </p>
        <p
          v-if="state"
          class="text-sm text-muted"
        >
          {{ t(state.closed ? 'challenge.closedAt' : 'challenge.closes', { date }) }}
        </p>
      </header>

      <div
        v-if="state"
        class="flex flex-wrap gap-3"
      >
        <UButton
          :to="localePath(`/heritage/challenge/${state.code}/leaderboard`)"
          icon="i-lucide-list-ordered"
          data-testid="challenge-scoreboard-link"
        >
          {{ t(state.closed ? 'challenge.final' : 'challenge.leaderboard') }}
        </UButton>
        <UButton
          :to="localePath('/heritage/challenge')"
          color="neutral"
          variant="outline"
        >
          {{ t('challenge.ownChallenge') }}
        </UButton>
      </div>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        :description="error"
        role="alert"
      />
      <UButton
        v-if="!details"
        @click="load"
      >
        {{ t('challenge.retry') }}
      </UButton>
      <UAlert
        v-if="details?.sample"
        color="warning"
        variant="subtle"
        icon="i-lucide-flask-conical"
        :description="t('challenge.sampleNotice')"
      />

      <UAlert
        v-if="state?.closed"
        :title="t('challenge.closed')"
        :description="t('challenge.closedNotice')"
        color="neutral"
        icon="i-lucide-lock-keyhole"
      />

      <template v-if="details && !participant && !closed">
        <div class="grid gap-3 sm:grid-cols-3">
          <UCard
            v-for="(round, index) in details.rounds"
            :key="index"
          >
            <p class="text-sm text-primary">
              {{ t('challenge.round', { number: index + 1 }) }}
            </p>
            <h2 class="mt-2 font-semibold">
              {{ text(round.topic) }}
            </h2>
            <p class="mt-2 text-sm text-muted">
              {{ t('challenge.questions', { count: round.count }) }}
            </p>
          </UCard>
        </div>
        <p class="font-semibold">
          {{ t('challenge.maximum', { points: details.maxScore }) }}
        </p>
        <p
          v-if="state?.targetScore !== null && state?.targetScore !== undefined"
          class="text-primary"
        >
          {{ t('challenge.target', { points: state.targetScore }) }}
        </p>
        <div class="space-y-3 text-sm text-muted">
          <p>{{ t('challenge.rules') }}</p>
          <p>{{ t('challenge.resumeNotice') }}</p>
          <p>{{ t('challenge.interruption') }}</p>
          <p>{{ t('challenge.expiry') }}</p>
        </div>
        <UButton
          v-if="!entering"
          size="lg"
          icon="i-lucide-flag"
          @click="entering = true"
        >
          {{ t(props.code ? 'challenge.join' : 'challenge.start') }}
        </UButton>
        <UCard v-else>
          <form
            class="space-y-5"
            @submit.prevent="enter"
          >
            <h2 class="text-xl font-semibold">
              {{ t('challenge.nicknameTitle') }}
            </h2>
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
                autofocus
              />
            </UFormField>
            <div class="flex flex-wrap gap-3">
              <UButton
                type="submit"
                :loading="busy"
              >
                {{ t(props.code ? 'challenge.enter' : 'challenge.create') }}
              </UButton>
              <UButton
                color="neutral"
                variant="ghost"
                :disabled="busy"
                @click="entering = false"
              >
                {{ t('challenge.cancel') }}
              </UButton>
            </div>
          </form>
        </UCard>
      </template>

      <template v-if="participant && !closed">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-muted">{{ participant.nickname }}</span>
          <strong aria-live="polite">{{ t('challenge.total', { points: participant.total }) }}</strong>
        </div>

        <UCard
          v-if="participant.phase === 'ready'"
          class="space-y-4"
        >
          <div class="space-y-4">
            <p class="text-sm text-primary">
              {{ t('challenge.round', { number: readyRound + 1 }) }}
            </p>
            <h2 class="text-xl font-semibold">
              {{ text(state!.rounds[readyRound]!.topic) }}
            </h2>
            <p class="text-sm text-muted">
              {{ t('challenge.interruption') }}
            </p>
            <UButton
              :loading="busy"
              @click="act('reveal')"
            >
              {{ t(participant.index === 0 || state!.rounds.slice(0, readyRound).reduce((n, r) => n + r.count, 0) === participant.index ? 'challenge.beginRound' : 'challenge.nextQuestion') }}
            </UButton>
          </div>
        </UCard>

        <UCard
          v-if="question"
          data-testid="challenge-question"
        >
          <div class="space-y-5">
            <div class="text-sm text-primary">
              {{ t('challenge.round', { number: question.round + 1 }) }} · {{ t('challenge.question', { number: question.number, count: state!.rounds[question.round]!.count }) }}
            </div>
            <h2 class="text-xl leading-relaxed font-semibold">
              {{ text(question.prompt) }}
            </h2>
            <div
              class="grid gap-3"
              role="group"
              :aria-label="text(question.prompt)"
            >
              <UButton
                v-for="(option, index) in question.options"
                :key="index"
                :color="feedback ? index === feedback.correct ? 'success' : index === feedback.selected ? 'error' : 'neutral' : 'neutral'"
                :variant="feedback && index === feedback.correct ? 'subtle' : 'outline'"
                :disabled="busy || !!feedback || !!state?.closed"
                size="lg"
                class="justify-start whitespace-normal text-left"
                :data-option="index"
                @click="act('answer', { questionId: question.id, selected: index })"
              >
                <span class="shrink-0 font-bold">{{ String.fromCharCode(65 + index) }}.</span>
                {{ text(option) }}
              </UButton>
            </div>
            <UButton
              v-if="!feedback && !state?.closed"
              color="neutral"
              variant="ghost"
              :disabled="busy"
              @click="act('answer', { questionId: question.id, selected: null })"
            >
              {{ t('challenge.skip') }}
            </UButton>
            <div
              v-if="feedback"
              class="space-y-4 border-t border-default pt-5"
              role="status"
              data-testid="challenge-feedback"
            >
              <p class="text-lg font-semibold">
                {{ t(feedback.selected === null ? 'challenge.skipped' : feedback.points ? 'challenge.correct' : 'challenge.incorrect') }} {{ t('challenge.earned', { points: feedback.points }) }}
              </p>
              <p class="font-semibold">
                {{ t('challenge.correctAnswer', { answer: text(question.options[feedback.correct]!) }) }}
              </p>
              <p class="leading-relaxed text-muted">
                {{ text(feedback.explanation) }}
              </p>
              <UButton
                :loading="busy"
                trailing-icon="i-lucide-arrow-right"
                @click="advance"
              >
                {{ t('challenge.continue') }}
              </UButton>
            </div>
          </div>
        </UCard>

        <UCard
          v-if="participant.phase === 'round'"
          data-testid="challenge-round-summary"
        >
          <div class="space-y-5">
            <h2 class="text-2xl font-semibold">
              {{ t('challenge.roundSummary') }}
            </h2>
            <div
              v-for="(round, index) in participant.rounds.filter(r => r.answered === r.count)"
              :key="index"
              class="flex items-center justify-between gap-3"
            >
              <span>{{ text(round.topic) }}</span><strong>{{ round.score }} / {{ round.count * 100 }}</strong>
            </div>
            <p class="text-sm text-muted">
              {{ t('challenge.resumeNotice') }}
            </p>
            <UButton
              :loading="busy"
              @click="advance"
            >
              {{ t(participant.completedAt ? 'challenge.finish' : 'challenge.nextRound') }}
            </UButton>
          </div>
        </UCard>

        <div
          v-if="participant.phase === 'finished'"
          class="space-y-6"
          data-testid="challenge-finish"
        >
          <UAlert
            :title="t('challenge.finished')"
            :description="t('challenge.finishedNotice')"
            color="success"
            icon="i-lucide-trophy"
          />
          <UCard>
            <div class="space-y-4">
              <div
                v-for="(round, index) in participant.rounds"
                :key="index"
                class="flex items-center justify-between gap-3"
              >
                <span>{{ text(round.topic) }}</span><strong>{{ round.score }} / {{ round.count * 100 }}</strong>
              </div>
            </div>
          </UCard>
        </div>
      </template>
      <HeritageChallengeShare
        v-if="state"
        :code="state.code"
      />
    </div>
  </UContainer>
</template>
