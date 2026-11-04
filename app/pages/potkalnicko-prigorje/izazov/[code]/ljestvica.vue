<script setup lang="ts">
import type { ChallengeLeaderboard, ChallengeState, ChallengeText } from '../../../../../shared/utils/challenge'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const code = String(route.params.code)
const state = ref<ChallengeState | null>(null)
const board = ref<ChallengeLeaderboard>({ rows: [], count: 0 })
const loading = ref(true)
const error = ref(false)
const { markSeen } = useChallengeList()
const text = (value: ChallengeText) => value[locale.value === 'en' ? 'en' : 'hr']
const date = computed(() => state.value ? new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'hr-HR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(state.value.closesAt)) : '')
useSeoMeta({ title: () => t('challenge.leaderboard'), robots: 'noindex, nofollow' })

async function load(more = false) {
  loading.value = true
  error.value = false
  try {
    const [next, challenge] = await Promise.all([
      $fetch<ChallengeLeaderboard>(`/api/challenges/${code}/ljestvica`, { query: { offset: more ? board.value.rows.length : 0 } }),
      $fetch<ChallengeState>(`/api/challenges/${code}`)
    ])
    board.value = { count: next.count, rows: more ? [...board.value.rows, ...next.rows] : next.rows }
    state.value = challenge
    markSeen(code, next.count)
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}
onMounted(() => void load())
</script>

<template>
  <UContainer class="max-w-3xl space-y-6 py-10 sm:py-16">
    <UButton
      :to="localePath(`/potkalnicko-prigorje/izazov/${code}`)"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="link"
    >
      {{ t('challenge.back') }}
    </UButton>
    <UBadge
      v-if="state?.sample"
      color="warning"
      variant="subtle"
    >
      {{ t('challenge.sample') }}
    </UBadge>
    <h1 class="text-3xl font-bold">
      {{ t(state?.closed ? 'challenge.final' : 'challenge.leaderboard') }}
    </h1>
    <p class="text-muted">
      {{ t('challenge.leaderboardIntro') }}
    </p>
    <p
      v-if="state"
      class="text-sm text-muted"
      data-testid="challenge-close-date"
    >
      {{ t(state.closed ? 'challenge.closedAt' : 'challenge.closes', { date }) }}
    </p>
    <UAlert
      v-if="state?.sample"
      :description="t('challenge.sampleNotice')"
      color="warning"
      variant="subtle"
    />
    <UAlert
      v-if="state?.closed"
      :title="t('challenge.closed')"
      :description="t('challenge.closedNotice')"
      color="neutral"
    />
    <UAlert
      v-if="error"
      :description="t('challenge.error')"
      color="error"
      role="alert"
    />
    <UButton
      v-if="error"
      @click="load()"
    >
      {{ t('challenge.retry') }}
    </UButton>
    <p
      v-if="loading"
      role="status"
    >
      {{ t('challenge.loading') }}
    </p>
    <p v-else-if="!error && !board.rows.length">
      {{ t('challenge.empty') }}
    </p>
    <ol
      class="space-y-4"
      data-testid="challenge-leaderboard"
    >
      <li
        v-for="row in board.rows"
        :key="row.nickname"
      >
        <UCard>
          <div class="flex items-center gap-4">
            <span
              class="text-xl font-bold text-primary"
              :aria-label="t('challenge.rank')"
            >{{ row.rank }}.</span>
            <span class="min-w-0 flex-1 wrap-anywhere font-semibold">{{ row.nickname }}</span>
            <strong>{{ row.total }} <span class="text-sm font-normal text-muted">{{ t('challenge.points') }}</span></strong>
          </div>
          <UBadge
            :color="row.completedAt ? 'success' : 'neutral'"
            variant="subtle"
            class="mt-3"
          >
            {{ t(row.completedAt ? 'challenge.completed' : state?.closed ? 'challenge.incomplete' : 'challenge.inProgress') }}
          </UBadge>
          <ul class="mt-4 space-y-1 text-sm text-muted">
            <li
              v-for="(points, index) in row.rounds"
              :key="index"
              class="flex justify-between gap-3"
            >
              <span>{{ state?.rounds[index] ? text(state.rounds[index]!.topic) : t('challenge.round', { number: index + 1 }) }}</span>
              <span>{{ points }}</span>
            </li>
          </ul>
        </UCard>
      </li>
    </ol>
    <UButton
      v-if="board.rows.length < board.count"
      :loading="loading"
      @click="load(true)"
    >
      {{ t('challenge.more') }}
    </UButton>
  </UContainer>
</template>
