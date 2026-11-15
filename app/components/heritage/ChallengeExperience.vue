<script setup lang="ts">
import type { ChallengeLeaderboard, ChallengeState, ChallengeText } from '~~/shared/utils/challenge'
import type { GameQuestion } from '~~/shared/utils/games/types'
import { DEFAULT_GENERATE } from '~~/shared/utils/challenge'
import { challengeDifficultyLabel, challengeMetaTopicSummary } from '~~/shared/utils/challengeShare'
import { pzRoutes } from '~~/shared/utils/appRoutes'
import type { CardKey } from '~~/shared/utils/learn/types'

const DEFAULT_OVERVIEW = {
  title: { hr: 'Brzi izazov', en: 'Quick challenge' } satisfies ChallengeText,
  sample: false,
  rounds: [
    { topic: { hr: 'Riječi', en: 'Words' }, count: 4 },
    { topic: { hr: 'Mjesta', en: 'Places' }, count: 3 },
    { topic: { hr: 'Baština', en: 'Heritage' }, count: 3 }
  ],
  maxScore: 1000,
  summary: {
    hr: '10 pitanja · Riječi + Mjesta + Baština · Srednje · do 1000 bodova',
    en: '10 questions · Words + Places + Heritage · Medium · up to 1000 points'
  }
} as const

const props = defineProps<{ code?: string }>()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const { pool } = useCardPool()
const { remember, update, find } = useChallengeList()
const state = ref<ChallengeState | null>(null)
const overview = ref<typeof DEFAULT_OVERVIEW | null>(null)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const nickname = ref('')
const text = (value: ChallengeText) => value[locale.value === 'en' ? 'en' : 'hr']
const participant = computed(() => state.value?.participant)
const question = computed(() => state.value?.question)
const feedback = computed(() => state.value?.feedback)
const details = computed(() => state.value ?? overview.value)
const closed = computed(() => state.value?.closed && !participant.value?.completedAt)
// Every step of the challenge ends in the sticky action bar (Kreni, Dalje, Sljedeća runda, Podijeli rezultat), which
// takes the tab bar's place from the intro on, so the two never stack at the bottom of the screen.
useHidePzTabBar(() => Boolean(state.value), 'challenge')
const readyRound = computed(() => {
  let remaining = participant.value?.index ?? 0
  for (const [index, round] of (state.value?.rounds ?? []).entries()) {
    if (remaining < round.count) return index
    remaining -= round.count
  }
  return 0
})
const date = computed(() => state.value ? new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'hr-HR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(state.value.closesAt)) : '')
const lang = computed(() => locale.value === 'en' ? 'en' as const : 'hr' as const)
const metaChips = computed(() => {
  const meta = state.value?.meta
  if (!meta) return []
  const chips: string[] = []
  if (meta.topics?.length) chips.push(challengeMetaTopicSummary(meta, pool.value, lang.value))
  if (meta.difficulty) chips.push(challengeDifficultyLabel(meta.difficulty, lang.value))
  return chips
})
const mapDifficulty = computed(() => state.value?.meta?.difficulty ?? 'srednje')
const mapPlaces = computed(() => pool.value.cards.filter(c => c.kind === 'place'))
const mapMunicipalities = computed(() => pool.value.municipalities)
const pendingMapChoice = ref<number | null>(null)

watch(question, () => {
  pendingMapChoice.value = null
})
const shareInvite = computed(() => {
  if (!state.value) return undefined
  const nickname = participant.value?.nickname
  if (!nickname && state.value.targetScore == null) return undefined
  return {
    nickname: nickname ?? t('challenge.shareHostFallback'),
    questionCount: state.value.questionCount,
    closesAt: state.value.closesAt,
    meta: state.value.meta,
    targetScore: state.value.targetScore
  }
})
const learnCards = ref<CardKey[]>([])
const learnHref = computed(() => {
  if (!learnCards.value.length) return ''
  const keys = learnCards.value.slice(0, 20).join(',')
  return localePath(`${pzRoutes.learn}/sesija?kartice=${encodeURIComponent(keys)}`)
})

async function loadLearnCards() {
  if (!props.code || participant.value?.phase !== 'finished') {
    learnCards.value = []
    return
  }
  try {
    const response = await $fetch<{ cards: CardKey[] }>(`/api/challenges/${props.code}/cards`)
    learnCards.value = response.cards
  } catch {
    learnCards.value = []
  }
}

watch(() => participant.value?.phase, (phase) => {
  if (phase === 'finished') void loadLearnCards()
}, { immediate: true })

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
    if (props.code) {
      state.value = await $fetch<ChallengeState>(`/api/challenges/${props.code}`)
      const existing = state.value ? find(state.value.code) : undefined
      if (state.value) {
        if (!existing) remember(state.value, state.value.participant ? 'player' : 'visitor')
        else update(state.value)
      }
    } else overview.value = { ...DEFAULT_OVERVIEW }
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
    if (state.value) {
      if (action === 'create') remember(state.value, 'creator')
      else if (action === 'join') remember(state.value, 'player')
      else update(state.value)
    }
    if (action === 'create') await navigateTo(localePath(`/izazov/${state.value.code}`))
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
  await act(props.code ? 'join' : 'create', props.code ? { nickname: name } : { nickname: name, generate: DEFAULT_GENERATE })
}

const board = ref<ChallengeLeaderboard | null>(null)
const shareOpen = ref(false)
const origin = ref('')
const feedbackCard = useTemplateRef<{ focus: () => void }>('feedbackCard')

async function loadBoard() {
  if (!props.code) return
  try {
    board.value = await $fetch<ChallengeLeaderboard>(`/api/challenges/${props.code}/leaderboard`)
  } catch {
    board.value = null
  }
}
watch(() => participant.value?.phase, (phase) => {
  if (phase === 'round' || phase === 'finished') void loadBoard()
}, { immediate: true })
watch(feedback, async (value) => {
  if (!value) return
  await nextTick()
  feedbackCard.value?.focus()
})

const myRow = computed(() => board.value?.rows.find(row => row.nickname === participant.value?.nickname))
const sharedRank = computed(() => Boolean(myRow.value && board.value?.rows.some(row => row !== myRow.value && row.rank === myRow.value!.rank)))
const boardPreview = computed(() => (board.value?.rows ?? []).slice(0, 5))
const lastRound = computed(() => {
  const rounds = participant.value?.rounds ?? []
  const index = rounds.findLastIndex(round => round.answered === round.count)
  return index < 0 ? null : { index, ...rounds[index]! }
})
// The multiple-choice renderer of the game kit, fed from the challenge's question. The right answer is only
// known once it is answered, so it stays out of range until then.
const optionsQuestion = computed(() => question.value
  ? { id: question.value.id, prompt: question.value.prompt, options: question.value.options, correct: feedback.value?.correct ?? -1 } as unknown as GameQuestion
  : null)
const optionsSelected = computed(() => feedback.value ? (feedback.value.selected ?? -1) : null)
const lastQuestion = computed(() => (participant.value?.index ?? 0) + 1 >= (state.value?.questionCount ?? 0))
const shareUrl = computed(() => state.value ? origin.value + localePath(`/izazov/${state.value.code}`) : '')
const resultMessage = computed(() => state.value && participant.value
  ? `${t('pz.challenge.shareResultText', { title: text(state.value.title), points: participant.value.total })}\n${t('pz.share.invite')}\n${shareUrl.value}`
  : '')

function openShare() {
  shareOpen.value = true
}

// The one primary action of the screen, in the sticky bar on mobile and under the content from 1024px up.
interface PrimaryAction { label: string, icon?: string, trailing?: string, to?: string, submit?: string, run?: () => unknown }
const primary = computed((): PrimaryAction | null => {
  if (state.value?.closed) return { label: t('pz.challenge.newChallenge'), icon: 'i-lucide-flag', to: localePath('/izazov') }
  if (!participant.value) return state.value ? { label: t('challenge.enter'), trailing: 'i-lucide-arrow-right', submit: 'challenge-enter-form' } : null
  if (participant.value.phase === 'ready') {
    const first = participant.value.index === 0 || state.value!.rounds.slice(0, readyRound.value).reduce((n, r) => n + r.count, 0) === participant.value.index
    return { label: t(first ? 'challenge.playFirst' : 'challenge.nextQuestion'), trailing: 'i-lucide-arrow-right', run: () => act('reveal') }
  }
  if (participant.value.phase === 'round') return { label: t(participant.value.completedAt ? 'challenge.finish' : 'challenge.nextRound'), trailing: 'i-lucide-arrow-right', run: advance }
  if (participant.value.phase === 'finished') return { label: t('pz.challenge.shareResult'), icon: 'i-lucide-share-2', run: openShare }
  return null
})

async function advance() {
  if (!participant.value) return
  await act('continue', { phase: participant.value.phase, index: participant.value.index })
  if (!error.value && participant.value?.phase === 'ready' && !state.value?.closed) await act('reveal')
}

function chooseMapOption(index: number) {
  if (!question.value || busy.value || feedback.value || state.value?.closed) return
  pendingMapChoice.value = index
  void act('answer', { questionId: question.value.id, selected: index })
}

onMounted(() => {
  origin.value = window.location.origin
  void load()
})
</script>

<template>
  <UContainer class="max-w-3xl py-6 sm:py-10">
    <UButton
      :to="localePath('')"
      color="neutral"
      variant="link"
      icon="i-lucide-arrow-left"
      class="mb-4 min-h-(--pz-tap-min)"
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
      class="flex flex-col gap-6"
    >
      <header class="relative flex flex-col gap-3 overflow-hidden rounded-(--pz-radius-xl) py-2">
        <PzRidge
          v-if="!participant"
          class="absolute -top-2 right-0 h-28 w-3/4 opacity-80"
        />
        <p class="pz-overline relative text-muted">
          {{ t('pz.challenge.introOverline') }}
        </p>
        <HeritageSampleBadge v-if="details?.sample" />
        <h1 class="pz-display relative text-highlighted wrap-anywhere">
          {{ props.code && details ? text(details.title) : overview ? text(overview.title) : t('challenge.newTitle') }}
        </h1>
        <p
          v-if="!participant && !props.code && overview?.summary"
          class="pz-lead relative text-muted"
        >
          {{ text(overview.summary) }}
        </p>
        <p
          v-else-if="!participant"
          class="pz-lead relative text-muted"
        >
          {{ t(props.code ? 'challenge.intro' : 'challenge.newIntro') }}
        </p>
        <div
          v-if="metaChips.length"
          class="relative flex flex-wrap gap-2"
          data-testid="challenge-meta-chips"
        >
          <UBadge
            v-for="chip in metaChips"
            :key="chip"
            color="primary"
            variant="subtle"
          >
            {{ chip }}
          </UBadge>
        </div>
        <p
          v-if="state"
          class="pz-body-sm relative inline-flex items-center gap-1.5 text-muted"
        >
          <UIcon
            name="i-lucide-calendar"
            class="size-4"
          />
          {{ t(state.closed ? 'challenge.closedAt' : 'challenge.closes', { date }) }}
        </p>
      </header>

      <div
        v-if="state"
        class="flex flex-wrap gap-2"
      >
        <UButton
          :to="localePath(`/izazov/${state.code}/ljestvica`)"
          icon="i-lucide-trophy"
          color="neutral"
          variant="outline"
          data-testid="challenge-scoreboard-link"
        >
          {{ t(state.closed ? 'challenge.final' : 'challenge.leaderboard') }}
        </UButton>
        <UButton
          :to="localePath('/izazov')"
          color="neutral"
          variant="ghost"
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
        :title="t('pz.challenge.closedOn', { date })"
        :description="t('pz.challenge.closedRead')"
        color="error"
        variant="subtle"
        icon="i-lucide-lock"
        data-testid="challenge-closed"
      />

      <!-- 1 · Intro: the rules in short rows, the nickname, Kreni in the sticky bar -->
      <form
        v-if="details && !participant && !closed"
        id="challenge-enter-form"
        class="flex flex-col gap-6"
        data-testid="challenge-intro"
        @submit.prevent="enter"
      >
        <div class="grid grid-cols-3 gap-2">
          <div
            v-for="(round, index) in details.rounds"
            :key="index"
            class="min-w-0 rounded-(--pz-radius-md) border border-default bg-default p-3"
          >
            <p class="pz-overline text-muted">
              {{ t('challenge.round', { number: index + 1 }) }}
            </p>
            <h2 class="pz-h3 mt-1 text-highlighted wrap-anywhere">
              {{ text(round.topic) }}
            </h2>
            <p class="pz-body-sm text-muted">
              {{ t('challenge.questions', { count: round.count }) }}
            </p>
          </div>
        </div>
        <ul class="m-0 flex list-none flex-col gap-3 p-0">
          <li class="flex items-center gap-3">
            <span class="grid size-10 shrink-0 place-items-center rounded-(--pz-radius-md) bg-accented text-default"><UIcon
              name="i-lucide-layers"
              class="size-5"
            /></span>
            <span class="pz-body">{{ t('challenge.maximum', { points: details.maxScore }) }}</span>
          </li>
          <li class="flex items-center gap-3">
            <span class="grid size-10 shrink-0 place-items-center rounded-(--pz-radius-md) bg-accented text-default"><UIcon
              name="i-lucide-users"
              class="size-5"
            /></span>
            <span class="pz-body">{{ t('pz.challenge.samePool') }}</span>
          </li>
          <li
            v-if="state"
            class="flex items-center gap-3"
          >
            <span class="grid size-10 shrink-0 place-items-center rounded-(--pz-radius-md) bg-accented text-default"><UIcon
              name="i-lucide-calendar"
              class="size-5"
            /></span>
            <span class="pz-body">{{ t('challenge.closes', { date }) }}</span>
          </li>
          <li
            v-if="state?.targetScore !== null && state?.targetScore !== undefined"
            class="flex items-center gap-3"
          >
            <span class="grid size-10 shrink-0 place-items-center rounded-(--pz-radius-md) bg-accented text-default"><UIcon
              name="i-lucide-target"
              class="size-5"
            /></span>
            <span class="pz-body">{{ t('challenge.target', { points: state.targetScore }) }}</span>
          </li>
        </ul>
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
            size="xl"
            class="w-full"
          />
        </UFormField>
        <div class="flex flex-col gap-2">
          <p class="pz-body-sm text-muted">
            {{ t('challenge.rules') }}
          </p>
          <p class="pz-body-sm text-muted">
            {{ t('challenge.resumeNotice') }}
          </p>
          <p class="pz-body-sm text-muted">
            {{ t('challenge.interruption') }}
          </p>
          <p class="pz-body-sm text-muted">
            {{ t('challenge.expiry') }}
          </p>
        </div>
        <UButton
          type="submit"
          :loading="busy"
          trailing-icon="i-lucide-arrow-right"
          size="xl"
          block
          class="hidden lg:flex"
          data-testid="challenge-enter"
        >
          {{ t(props.code ? 'challenge.enter' : 'challenge.create') }}
        </UButton>
      </form>

      <template v-if="participant && !closed">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="pz-body-sm text-muted wrap-anywhere">{{ participant.nickname }}</span>
          <strong
            class="pz-label text-highlighted"
            aria-live="polite"
          >{{ t('challenge.total', { points: participant.total }) }}</strong>
        </div>

        <!-- 2 · Before a round: which round is next -->
        <section
          v-if="participant.phase === 'ready'"
          class="flex flex-col gap-3 rounded-(--pz-radius-lg) border border-default bg-default p-4"
          data-testid="challenge-ready"
        >
          <p class="pz-overline text-muted">
            {{ t('pz.challenge.roundOverline', { number: readyRound + 1, count: state!.rounds.length, topic: text(state!.rounds[readyRound]!.topic) }) }}
          </p>
          <h2 class="pz-h2 text-highlighted">
            {{ text(state!.rounds[readyRound]!.topic) }}
          </h2>
          <p class="pz-body-sm text-muted">
            {{ t('challenge.interruption') }}
          </p>
        </section>

        <!-- 3 · A question: the game kit's options and feedback, an explicit Dalje -->
        <section
          v-if="question && optionsQuestion"
          class="flex flex-col gap-4"
          data-testid="challenge-question"
        >
          <p class="pz-overline text-muted">
            {{ t('challenge.round', { number: question.round + 1 }) }} · {{ t('challenge.question', { number: question.number, count: state!.rounds[question.round]!.count }) }}
          </p>
          <div class="flex flex-col gap-4 rounded-(--pz-radius-lg) bg-muted p-4">
            <h2
              id="challenge-prompt"
              class="pz-h2 text-highlighted wrap-anywhere"
            >
              {{ text(question.prompt) }}
            </h2>
            <GamesMapView
              v-if="question.display"
              :places="mapPlaces"
              :municipalities="mapMunicipalities"
              :difficulty="mapDifficulty"
              mode="target"
              layer-locked="karta"
              :target-point="question.display.type === 'map-target' ? question.display.point : undefined"
              :numbered-points="question.display.type === 'map-points' ? question.display.points : undefined"
              :disabled="busy || !!feedback || !!state?.closed"
              data-testid="challenge-map"
              @select-index="chooseMapOption"
            />
            <GamesOptions
              :question="optionsQuestion"
              :selected="optionsSelected"
              labelledby="challenge-prompt"
              @select="(index: number) => !busy && !state?.closed && act('answer', { questionId: question!.id, selected: index })"
            />
          </div>
          <UButton
            v-if="!feedback && !state?.closed"
            color="neutral"
            variant="ghost"
            :disabled="busy"
            class="self-start"
            @click="act('answer', { questionId: question.id, selected: null })"
          >
            {{ t('challenge.skip') }}
          </UButton>
          <template v-if="feedback">
            <GamesFeedback
              ref="feedbackCard"
              :correct="feedback.points > 0"
              :title="feedback.selected === null ? t('challenge.skipped') : undefined"
              :answer="text(question.options[feedback.correct]!)"
              :explanation="text(feedback.explanation)"
              :lang="lang"
              data-testid="challenge-feedback"
            >
              <p class="pz-body-sm text-muted">
                {{ t('challenge.earned', { points: feedback.points }) }}
              </p>
            </GamesFeedback>
            <GamesDalje
              :last="lastQuestion"
              @next="advance"
            />
          </template>
        </section>

        <!-- 4 · After a round: the round's total and where you stand -->
        <section
          v-if="participant.phase === 'round'"
          class="flex flex-col gap-4"
          data-testid="challenge-round-summary"
        >
          <div class="flex flex-col items-center gap-2 pt-2 text-center">
            <h2 class="pz-overline text-muted">
              {{ t('challenge.roundSummary') }}<template v-if="lastRound">
                · {{ text(lastRound.topic) }}
              </template>
            </h2>
            <p
              v-if="lastRound"
              class="pz-numeral text-[56px]/[60px] text-highlighted"
            >
              {{ lastRound.score }} / {{ lastRound.count * 100 }}
            </p>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="(round, index) in participant.rounds"
              :key="index"
              class="rounded-(--pz-radius-md) border bg-default p-3"
              :class="index === lastRound?.index ? 'border-2 border-primary' : 'border-default'"
            >
              <b
                class="block text-2xl/7 font-bold tabular-nums"
                :class="round.answered === round.count ? 'text-highlighted' : 'text-dimmed'"
              >{{ round.answered === round.count ? round.score : '–' }}</b>
              <span class="pz-caption text-muted">{{ t('pz.challenge.roundTotal', { number: index + 1 }) }}</span>
            </div>
          </div>
          <p
            class="pz-body flex flex-wrap items-center justify-between gap-2 rounded-(--pz-radius-lg) border border-default bg-muted px-4 py-3"
            data-testid="challenge-standing"
          >
            <span>
              {{ t('pz.challenge.totalLine', { points: participant.total }) }}<template v-if="myRow">
                · <b>{{ myRow.rank }}.</b>
              </template>
            </span>
            <NuxtLink
              :to="localePath(`/izazov/${state!.code}/ljestvica`)"
              class="pz-body-sm font-semibold underline"
            >
              {{ t('challenge.leaderboard') }}
            </NuxtLink>
          </p>
          <p class="pz-body-sm text-muted">
            {{ t('challenge.resumeNotice') }}
          </p>
        </section>

        <!-- 5 · Finished: the total, your rank, the leaderboard preview, Podijeli rezultat -->
        <section
          v-if="participant.phase === 'finished'"
          class="flex flex-col gap-4"
          data-testid="challenge-finish"
        >
          <div class="flex flex-col items-center gap-3 pt-2 text-center">
            <h2 class="pz-overline text-muted">
              {{ t('pz.challenge.finalOverline') }}
            </h2>
            <p class="pz-numeral text-[56px]/[60px] text-highlighted">
              {{ participant.total }} / {{ state!.maxScore }}
            </p>
            <p
              v-if="myRow"
              class="pz-lead"
              data-testid="challenge-your-rank"
            >
              {{ t(sharedRank ? 'pz.challenge.sharedRank' : 'pz.challenge.yourRank', { rank: myRow.rank }) }}
            </p>
            <PzStitch />
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="(round, index) in participant.rounds"
              :key="index"
              class="min-w-0 rounded-(--pz-radius-md) border border-default bg-default p-3"
            >
              <b class="block text-2xl/7 font-bold text-highlighted tabular-nums">{{ round.score }}</b>
              <span class="pz-caption text-muted wrap-anywhere">{{ text(round.topic) }} · {{ round.count * 100 }}</span>
            </div>
          </div>
          <div
            v-if="boardPreview.length"
            class="rounded-(--pz-radius-lg) border border-default bg-default p-2"
          >
            <PzLeaderboard
              :rows="boardPreview"
              :round-count="state!.rounds.length"
              :me="participant.nickname"
              :closed="state!.closed"
              :caption="text(state!.title)"
            />
          </div>
          <UButton
            :to="localePath(`/izazov/${state!.code}/ljestvica`)"
            icon="i-lucide-trophy"
            color="neutral"
            variant="outline"
            size="lg"
            block
          >
            {{ t('pz.challenge.fullBoard') }}
          </UButton>
          <UButton
            v-if="learnHref"
            :to="learnHref"
            icon="i-lucide-book-open"
            color="neutral"
            variant="outline"
            size="lg"
            block
            data-testid="challenge-learn-cards"
          >
            {{ t('challenge.learnQuestions') }}
          </UButton>
        </section>
      </template>

      <!-- Pozovi: the link preview and the share rows -->
      <HeritageChallengeShare
        v-if="state && !state.closed"
        id="challenge-share"
        :code="state.code"
        :title="text(state.title)"
        :invite="shareInvite"
      />

      <!-- The screen's one primary action: the sticky bar below 1024px, under the content from there up -->
      <template v-if="primary && !(question && feedback)">
        <template v-if="!primary.submit">
          <UButton
            :to="primary.to"
            :label="primary.label"
            :icon="primary.icon"
            :trailing-icon="primary.trailing"
            :loading="busy"
            size="xl"
            block
            class="hidden lg:flex"
            data-testid="challenge-primary-desktop"
            @click="primary.run?.()"
          />
        </template>
        <PzStickyActionBar class="-mx-4 sm:-mx-6">
          <UButton
            :to="primary.to"
            :label="primary.label"
            :icon="primary.icon"
            :trailing-icon="primary.trailing"
            :type="primary.submit ? 'submit' : 'button'"
            :form="primary.submit"
            :loading="busy"
            size="xl"
            block
            data-testid="challenge-primary"
            @click="primary.run?.()"
          />
        </PzStickyActionBar>
      </template>
    </div>

    <PzShareSheet
      v-if="state && participant"
      v-model:open="shareOpen"
      :title="t('pz.challenge.shareResult')"
      :context="t('pz.share.resultContext')"
      :message="resultMessage"
      :url="shareUrl"
      preview
      prefix="challenge-result"
    />
  </UContainer>
</template>
