<script setup lang="ts">
definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()

useSeoMeta({
  title: () => t('pz.games.hubTitle'),
  ogTitle: () => `${t('pz.games.hubTitle')} · Potkalnički zapisi`,
  ogDescription: () => t('pz.games.hubDescription'),
  description: () => t('pz.games.hubDescription')
})
</script>

<template>
  <div>
    <UPageHero
      :title="t('pz.games.hubTitle')"
      :description="t('pz.games.hubDescription')"
      :ui="{ container: 'py-12 sm:py-16', title: 'text-3xl sm:text-4xl', footer: 'hidden' }"
    />
    <HeritageDailyWord />
    <PzGamesHub />
  </div>
</template>
