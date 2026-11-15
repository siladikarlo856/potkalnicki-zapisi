<script setup lang="ts">
definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const route = useRoute()
useSeoMeta({ title: () => t('challenge.title'), robots: 'noindex, nofollow' })
</script>

<template>
  <HeritageChallengeExperience
    :key="String(route.params.code)"
    :code="String(route.params.code)"
  />
</template>
