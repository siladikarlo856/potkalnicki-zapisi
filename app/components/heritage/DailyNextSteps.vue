<script setup lang="ts">
const { t } = useI18n()
// The games pages are Croatian-only, so these are plain paths. Challenge a friend opens the quick quiz: its result screen creates the 7-day friend challenge.
const steps = [
  { id: 'learn', icon: 'i-lucide-book-open', path: '/potkalnicko-prigorje/igre/kartice' },
  { id: 'quiz', icon: 'i-lucide-zap', path: '/potkalnicko-prigorje/igre/kviz' },
  { id: 'challenge', icon: 'i-lucide-swords', path: '/potkalnicko-prigorje/igre/kviz' }
] as const
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
          :label="t(`daily.nextSteps.${step.id}`)"
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
