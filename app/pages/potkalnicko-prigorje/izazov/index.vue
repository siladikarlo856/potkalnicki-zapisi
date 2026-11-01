<script setup lang="ts">
definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
useSeoMeta({ title: () => t('challenge.title'), description: () => t('challenge.intro') })
</script>

<template>
  <HeritageChallengeExperience />
</template>
