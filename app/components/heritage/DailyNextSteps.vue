<script setup lang="ts">
import type { DailyCategory } from '~~/shared/utils/dailyWord'
import { wordSubtopicForCategory } from '~~/shared/utils/learn/topics'

const props = defineProps<{ category?: DailyCategory | null }>()

const { t } = useI18n()

const subtopic = computed(() => (props.category ? wordSubtopicForCategory(props.category) : undefined))

const learnPath = computed(() => {
  const topic = subtopic.value?.id ?? 'rijeci'
  return `/potkalnicko-prigorje/uci/sesija?teme=${topic}`
})

const learnLabel = computed(() => {
  if (subtopic.value) {
    return t('daily.nextSteps.learnCategory', { label: subtopic.value.label })
  }
  return t('daily.nextSteps.learnWords')
})

const steps = computed(() => [
  { id: 'learn' as const, icon: 'i-lucide-book-open', path: learnPath.value, label: learnLabel.value },
  { id: 'quiz' as const, icon: 'i-lucide-zap', path: '/potkalnicko-prigorje/igre/kviz', label: t('daily.nextSteps.quiz') },
  { id: 'challenge' as const, icon: 'i-lucide-swords', path: '/potkalnicko-prigorje/igre/kviz', label: t('daily.nextSteps.challenge') }
])
</script>

<template>
  <nav
    :aria-label="t('daily.nextSteps.title')"
    class="print:hidden"
    data-testid="daily-next-steps"
  >
    <h3 class="mb-2 text-sm font-semibold text-highlighted">
      {{ t('daily.nextSteps.title') }}
    </h3>
    <ul class="grid gap-2 sm:grid-cols-3">
      <li
        v-for="step in steps"
        :key="step.id"
      >
        <UButton
          :to="step.path"
          :icon="step.icon"
          :label="step.label"
          :data-testid="`daily-next-${step.id}`"
          color="neutral"
          variant="outline"
          block
          class="min-h-11 justify-start whitespace-normal"
        />
      </li>
    </ul>
  </nav>
</template>
