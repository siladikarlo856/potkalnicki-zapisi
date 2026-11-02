<script setup lang="ts">
import type { DailyStats } from '~~/shared/utils/dailyWord'
import { pluralForm } from '~/utils/dailyClues'

const props = defineProps<{
  stats: DailyStats
  /** Distribution row of today's result, outlined as well as colored. */
  today?: '1' | '2' | '3' | 'X'
}>()
const { locale, t } = useI18n()
const rows = computed(() => {
  const biggest = Math.max(1, ...Object.values(props.stats.distribution))
  return (['1', '2', '3', 'X'] as const).map(key => ({
    key,
    count: props.stats.distribution[key],
    width: `${Math.round(100 * props.stats.distribution[key] / biggest)}%`,
    label: key === 'X' ? t('daily.stats.missed') : t('daily.stats.tries', { n: key })
  }))
})
</script>

<template>
  <section
    class="flex min-w-0 flex-col gap-3"
    aria-labelledby="daily-stats-title"
    data-testid="daily-stats"
  >
    <h3
      id="daily-stats-title"
      class="text-sm font-semibold text-highlighted"
    >
      {{ t('daily.stats.title') }}
    </h3>
    <dl class="grid grid-cols-3 gap-2 text-center">
      <div
        class="rounded-lg bg-elevated p-2 flex flex-col-reverse"
        data-testid="daily-stat-streak"
      >
        <dt class="text-xs text-muted">
          {{ t('daily.stats.streak') }}
        </dt>
        <dd class="text-xl font-bold text-highlighted">
          {{ stats.streak }}
        </dd>
      </div>
      <div
        class="rounded-lg bg-elevated p-2 flex flex-col-reverse"
        data-testid="daily-stat-played"
      >
        <dt class="text-xs text-muted">
          {{ t('daily.stats.played') }}
        </dt>
        <dd class="text-xl font-bold text-highlighted">
          {{ stats.played }}
        </dd>
      </div>
      <div
        class="rounded-lg bg-elevated p-2 flex flex-col-reverse"
        data-testid="daily-stat-percent"
      >
        <dt class="text-xs text-muted">
          {{ t('daily.stats.correct') }}
        </dt>
        <dd class="text-xl font-bold text-highlighted">
          {{ stats.percentCorrect }}%
        </dd>
      </div>
    </dl>
    <p
      v-if="stats.maxStreak > stats.streak"
      class="text-xs text-muted"
      data-testid="daily-stat-best"
    >
      {{ t('daily.stats.best', { n: stats.maxStreak, days: t(`daily.streakDays.${pluralForm(locale, stats.maxStreak)}`, { n: stats.maxStreak }) }) }}
    </p>
    <table
      class="w-full table-fixed text-sm"
      data-testid="daily-distribution"
    >
      <caption class="mb-1 text-start text-xs font-medium text-muted">
        {{ t('daily.stats.distribution') }}
      </caption>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.key"
          :data-today="today === row.key ? 'true' : undefined"
        >
          <th
            scope="row"
            class="w-1/3 py-0.5 pe-2 text-start font-normal text-muted"
          >
            {{ row.label }}
          </th>
          <td class="py-0.5">
            <div class="flex items-center gap-2">
              <div
                class="h-5 min-w-0 flex-1"
                aria-hidden="true"
              >
                <div
                  :class="['h-full rounded-sm', today === row.key ? 'bg-primary outline-2 outline-offset-1 outline-primary' : 'bg-primary/50']"
                  :style="{ width: row.width, minWidth: row.count ? '0.25rem' : '0' }"
                />
              </div>
              <span class="w-6 shrink-0 text-end font-medium tabular-nums">{{ row.count }}</span>
              <span
                v-if="today === row.key"
                class="w-12 shrink-0 text-xs text-primary"
              >{{ t('daily.stats.todayMarker') }}</span>
              <span
                v-else
                class="w-12 shrink-0"
                aria-hidden="true"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
