<script setup lang="ts">
import type { ChallengeLeaderboard, ChallengeState, ChallengeText } from '../../../../shared/utils/challenge'
import { pzRoutes } from '../../../../shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

// ScreenLeaderboard: the challenge title as an overline, "Ljestvica", the close date as a chip (or, once closed,
// a brick notice that leaves the table fully readable), the table, and one primary action in the sticky bar.
const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const code = String(route.params.code)
const state = ref<ChallengeState | null>(null)
const board = ref<ChallengeLeaderboard>({ rows: [], count: 0, completedCount: 0 })
const loading = ref(true)
const error = ref(false)
const missing = ref(false)
const { markSeen, find } = useChallengeList()
const text = (value: ChallengeText) => value[locale.value === 'en' ? 'en' : 'hr']
const date = computed(() => state.value ? new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'hr-HR', { dateStyle: 'long' }).format(new Date(state.value.closesAt)) : '')
const me = computed(() => state.value?.participant?.nickname ?? null)
const owner = computed(() => find(code)?.role === 'creator' || Boolean(state.value?.participant?.completedAt))
const roundCount = computed(() => state.value?.rounds.length ?? Math.max(0, ...board.value.rows.map(row => row.rounds.length)))
const shareOpen = ref(false)
const origin = ref('')
const shareUrl = computed(() => origin.value + localePath(pzPath(pzRoutes.challenge, code, 'ljestvica')))
const myRow = computed(() => board.value.rows.find(row => row.nickname === me.value))
const shareMessage = computed(() => state.value && myRow.value
  ? `${text(state.value.title)}: ${myRow.value.rank}. mjesto, ${myRow.value.total} bodova.\n${shareUrl.value}`
  : shareUrl.value)
const placeTitle = computed(() => {
  const rank = board.value.rows.find(row => row.nickname === me.value)?.rank
  if (!rank) return t('challenge.leaderboard')
  if (rank === 1) return t('challenge.firstPlace')
  if (rank === 2) return t('challenge.secondPlace')
  if (rank === 3) return t('challenge.thirdPlace')
  return t('challenge.numberedPlace', { rank })
})
useSeoMeta({ title: () => t('challenge.leaderboard'), robots: 'noindex, nofollow' })
// The sticky action bar owns the bottom of this screen, so the tab bar steps aside once it is there.
useHidePzTabBar(() => Boolean(state.value), 'challenge')

async function load(more = false) {
  loading.value = true
  error.value = false
  missing.value = false
  try {
    const [next, challenge] = await Promise.all([
      $fetch<ChallengeLeaderboard>(`/api/challenges/${code}/leaderboard`, { query: { offset: more ? board.value.rows.length : 0 } }),
      $fetch<ChallengeState>(`/api/challenges/${code}`)
    ])
    board.value = { ...next, rows: more ? [...board.value.rows, ...next.rows] : next.rows }
    state.value = challenge
    markSeen(code, next.count)
  } catch (cause) {
    const failure = cause as { status?: number, statusCode?: number }
    if ((failure.status ?? failure.statusCode) === 404) missing.value = true
    else error.value = true
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  origin.value = window.location.origin
  void load()
})
</script>

<template>
  <UContainer class="max-w-3xl py-6 sm:py-10">
    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-3">
          <UButton
            :to="localePath(pzPath(pzRoutes.challenge, code))"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="link"
            class="min-h-(--pz-tap-min) self-start"
          >
            {{ t('challenge.back') }}
          </UButton>
          <UButton
            icon="i-lucide-share-2"
            color="neutral"
            variant="ghost"
            :aria-label="t('challenge.shareLeaderboard')"
            data-testid="challenge-leaderboard-share"
            @click="shareOpen = true"
          />
        </div>
        <p
          v-if="state"
          class="pz-overline text-muted wrap-anywhere"
        >
          {{ text(state.title) }}
        </p>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h1 class="pz-h1 text-highlighted">
            {{ t(state?.closed ? 'challenge.final' : 'challenge.leaderboard') }}
          </h1>
          <HeritageSampleBadge v-if="state?.sample" />
        </div>
        <span
          v-if="state && !state.closed"
          class="inline-flex items-center gap-1.5 self-start rounded-full border border-accented px-3 py-1 text-sm/5 font-medium text-default"
          data-testid="challenge-close-date"
        >
          <UIcon
            name="i-lucide-calendar"
            class="size-3.5"
          />
          {{ t('pz.challenge.closesChip', { date }) }}
        </span>
        <p
          v-if="state && !loading && me"
          class="pz-lead text-muted"
          data-testid="challenge-place-title"
        >
          {{ placeTitle }}
        </p>
        <p
          v-if="state && !loading"
          class="pz-body-sm text-muted"
          data-testid="challenge-played-count"
        >
          {{ t('challenge.playedCount', { played: board.completedCount, total: board.count }) }}
        </p>
      </header>

      <UAlert
        v-if="state?.closed"
        :title="t('pz.challenge.closedOn', { date })"
        :description="t('pz.challenge.closedRead')"
        color="error"
        variant="subtle"
        icon="i-lucide-lock"
        data-testid="challenge-closed"
      />
      <UAlert
        v-if="state?.sample"
        :description="t('challenge.sampleNotice')"
        color="warning"
        variant="subtle"
        icon="i-lucide-flask-conical"
      />

      <template v-if="missing">
        <UAlert
          :title="t('pz.challenge.notFoundTitle')"
          :description="t('pz.challenge.notFoundText')"
          color="neutral"
          variant="subtle"
          icon="i-lucide-compass"
          data-testid="challenge-missing"
        />
        <UButton
          :to="localePath(pzRoutes.challenge)"
          icon="i-lucide-flag"
          size="xl"
          block
        >
          {{ t('challenge.hubTitle') }}
        </UButton>
      </template>
      <template v-else-if="error">
        <UAlert
          :description="t('challenge.error')"
          color="error"
          variant="subtle"
          role="alert"
        />
        <UButton
          color="neutral"
          variant="outline"
          class="self-start"
          @click="load()"
        >
          {{ t('challenge.retry') }}
        </UButton>
      </template>

      <p
        v-if="loading"
        role="status"
        class="text-muted"
      >
        {{ t('challenge.loading') }}
      </p>
      <p
        v-else-if="!error && !missing && !board.rows.length"
        class="pz-body text-muted"
      >
        {{ t('challenge.empty') }}
      </p>
      <div
        v-if="board.rows.length"
        class="min-w-0 overflow-x-auto"
        :aria-busy="loading"
      >
        <PzLeaderboard
          :rows="board.rows"
          :round-count="roundCount"
          :me="me"
          :closed="state?.closed"
          :caption="state ? text(state.title) : undefined"
        />
      </div>
      <UButton
        v-if="board.rows.length < board.count"
        :loading="loading"
        color="neutral"
        variant="outline"
        class="self-start"
        @click="load(true)"
      >
        {{ t('challenge.more') }}
      </UButton>

      <template v-if="state">
        <UButton
          :to="state.closed ? localePath(pzRoutes.challenge) : localePath(`${pzPath(pzRoutes.challenge, code)}${owner ? '#challenge-share' : ''}`)"
          :label="state.closed ? t('pz.challenge.newChallenge') : owner ? t('pz.challenge.invitePlayers') : t('challenge.playChallenge')"
          :icon="state.closed ? 'i-lucide-flag' : owner ? 'i-lucide-share-2' : 'i-lucide-play'"
          size="xl"
          block
          class="hidden lg:flex"
          data-testid="challenge-board-primary-desktop"
        />
        <PzStickyActionBar class="-mx-4 sm:-mx-6">
          <UButton
            :to="state.closed ? localePath(pzRoutes.challenge) : localePath(`${pzPath(pzRoutes.challenge, code)}${owner ? '#challenge-share' : ''}`)"
            :label="state.closed ? t('pz.challenge.newChallenge') : owner ? t('pz.challenge.invitePlayers') : t('challenge.playChallenge')"
            :icon="state.closed ? 'i-lucide-flag' : owner ? 'i-lucide-share-2' : 'i-lucide-play'"
            size="xl"
            block
            data-testid="challenge-board-primary"
          />
        </PzStickyActionBar>
      </template>

      <PzShareSheet
        v-if="state"
        v-model:open="shareOpen"
        :title="t('challenge.shareLeaderboard')"
        :context="state.title.hr"
        :message="shareMessage"
        :url="shareUrl"
        preview
        prefix="challenge-leaderboard"
      />
    </div>
  </UContainer>
</template>
