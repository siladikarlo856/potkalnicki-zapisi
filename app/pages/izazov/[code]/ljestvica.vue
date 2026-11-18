<script setup lang="ts">
import type { ChallengeLeaderboard, ChallengeState, ChallengeText } from '../../../../shared/utils/challenge'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

// ScreenLeaderboard: the challenge title as an overline, "Ljestvica", the close date as a chip (or, once closed,
// a brick notice that leaves the table fully readable), the table, and one primary action in the sticky bar.
const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const code = String(route.params.code)
const state = ref<ChallengeState | null>(null)
const board = ref<ChallengeLeaderboard>({ rows: [], count: 0 })
const loading = ref(true)
const error = ref(false)
const missing = ref(false)
const { markSeen, find } = useChallengeList()
const text = (value: ChallengeText) => value[locale.value === 'en' ? 'en' : 'hr']
const date = computed(() => state.value ? new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'hr-HR', { dateStyle: 'long' }).format(new Date(state.value.closesAt)) : '')
const me = computed(() => state.value?.participant?.nickname ?? null)
const owner = computed(() => find(code)?.role === 'creator' || Boolean(state.value?.participant?.completedAt))
const roundCount = computed(() => state.value?.rounds.length ?? Math.max(0, ...board.value.rows.map(row => row.rounds.length)))
useSeoMeta({ title: () => t('challenge.leaderboard'), robots: 'noindex, nofollow' })
// The sticky action bar owns the bottom of this screen, so the tab bar steps aside once it is there.

async function load(more = false) {
  loading.value = true
  error.value = false
  missing.value = false
  try {
    const [next, challenge] = await Promise.all([
      $fetch<ChallengeLeaderboard>(`/api/challenges/${code}/leaderboard`, { query: { offset: more ? board.value.rows.length : 0 } }),
      $fetch<ChallengeState>(`/api/challenges/${code}`)
    ])
    board.value = { count: next.count, rows: more ? [...board.value.rows, ...next.rows] : next.rows }
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
onMounted(() => void load())
</script>

<template>
  <UContainer class="max-w-3xl py-6 sm:py-10">
    <div class="flex flex-col gap-6">
      <UButton
        :to="localePath(`/izazov/${code}`)"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="link"
        class="min-h-(--pz-tap-min) self-start"
      >
        {{ t('challenge.back') }}
      </UButton>

      <header class="flex flex-col gap-3">
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
          :to="localePath('/izazov')"
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
          :to="state.closed ? localePath('/izazov') : localePath(`/izazov/${code}${owner ? '#challenge-share' : ''}`)"
          :label="state.closed ? t('pz.challenge.newChallenge') : owner ? t('pz.challenge.invitePlayers') : t('challenge.playChallenge')"
          :icon="state.closed ? 'i-lucide-flag' : owner ? 'i-lucide-share-2' : 'i-lucide-play'"
          size="xl"
          block
          class="hidden lg:flex"
          data-testid="challenge-board-primary-desktop"
        />
        <PzStickyActionBar class="-mx-4 sm:-mx-6">
          <UButton
            :to="state.closed ? localePath('/izazov') : localePath(`/izazov/${code}${owner ? '#challenge-share' : ''}`)"
            :label="state.closed ? t('pz.challenge.newChallenge') : owner ? t('pz.challenge.invitePlayers') : t('challenge.playChallenge')"
            :icon="state.closed ? 'i-lucide-flag' : owner ? 'i-lucide-share-2' : 'i-lucide-play'"
            size="xl"
            block
            data-testid="challenge-board-primary"
          />
        </PzStickyActionBar>
      </template>
    </div>
  </UContainer>
</template>
