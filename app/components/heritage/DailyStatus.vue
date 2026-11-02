<script setup lang="ts">
import { pluralForm } from '~/utils/dailyClues'

// One line for the Words flagship card; it shares the page's single daily word request.
const { locale, t } = useI18n()
const { payload } = useDailyWord()
const progress = useDailyProgress()
const result = computed(() => payload.value ? progress.days.value[payload.value.day] : undefined)
const finished = computed(() => result.value?.done ? result.value : undefined)
const stats = computed(() => payload.value ? progress.statsFor(payload.value.day) : undefined)
const streak = computed(() => stats.value?.streak
  ? t('daily.status.streak', { days: t(`daily.streakDays.${pluralForm(locale.value, stats.value.streak)}`, { n: stats.value.streak }) })
  : '')
const ready = computed(() => !!payload.value && progress.loaded.value)
</script>

<template>
  <div
    v-if="ready && payload"
    class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
    data-testid="daily-status"
  >
    <template v-if="finished">
      <span
        class="inline-flex items-center gap-1 font-medium text-highlighted"
        data-testid="daily-status-result"
      >
        <UIcon
          name="i-lucide-circle-check"
          class="size-4 text-primary"
          aria-hidden="true"
        />
        {{ t('daily.status.played', { result: `${finished.solved ? finished.tries : 'X'}/${finished.maxTries}` }) }}
      </span>
      <span
        v-if="streak"
        class="text-muted"
        data-testid="daily-status-streak"
      >· {{ streak }}</span>
      <span
        class="text-muted"
        aria-hidden="true"
      >·</span>
      <HeritageDailyCountdown :next-at="payload.nextAt" />
    </template>
    <template v-else>
      <span class="font-medium text-highlighted">{{ t('daily.status.waiting') }}</span>
      <span
        v-if="streak"
        class="text-muted"
        data-testid="daily-status-streak"
      >· {{ streak }}</span>
      <NuxtLink
        to="#rijec-dana"
        class="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        data-testid="daily-status-play"
      >
        {{ t('daily.status.play') }} →
      </NuxtLink>
    </template>
  </div>
</template>
