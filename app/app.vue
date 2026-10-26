<script setup lang="ts">
import { en, hr } from '@nuxt/ui/locale'

const { locale, t } = useI18n()
const i18nHead = useLocaleHead()

useHead({
  titleTemplate: title => title ? `${title} · Karlo Siladi` : 'Karlo Siladi',
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ]
})

useHead(() => ({
  htmlAttrs: { lang: i18nHead.value.htmlAttrs.lang },
  link: i18nHead.value.link,
  meta: i18nHead.value.meta
}))

useSeoMeta({
  description: () => t('meta.description'),
  ogDescription: () => t('meta.description')
})
</script>

<template>
  <UApp :locale="locale === 'hr' ? hr : en">
    <AppHeader />

    <UMain>
      <NuxtPage />
    </UMain>

    <AppFooter />
  </UApp>
</template>
