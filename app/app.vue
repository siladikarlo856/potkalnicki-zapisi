<script setup lang="ts">
import { en, hr as nuxtUiHr } from '@nuxt/ui/locale'

const hr = extendLocale(nuxtUiHr, {
  messages: {
    colorMode: {
      switchToDark: 'Uključi tamnu temu',
      switchToLight: 'Uključi svijetlu temu'
    }
  }
})

const { locale, t } = useI18n()
const i18nHead = useLocaleHead()

useHead({
  titleTemplate: title => title ? `${title} · Karlo Siladi` : 'Karlo Siladi',
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
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
