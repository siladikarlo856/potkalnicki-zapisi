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
const baseUrl = useRuntimeConfig().public.i18n.baseUrl
useThemeColor()

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
  ogTitle: 'Karlo Siladi',
  ogDescription: () => t('meta.description'),
  ogSiteName: 'Karlo Siladi',
  ogType: 'website',
  ogImage: () => `${baseUrl}/images/og/share-${locale.value}.jpg`,
  ogImageType: 'image/jpeg',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: () => t('meta.imageAlt'),
  twitterCard: 'summary_large_image',
  twitterImageAlt: () => t('meta.imageAlt')
})
</script>

<template>
  <UApp :locale="locale === 'hr' ? hr : en">
    <NuxtRouteAnnouncer />
    <SkipLink />
    <AppHeader />

    <UMain
      id="main-content"
      tabindex="-1"
      class="focus:outline-none"
    >
      <NuxtPage />
    </UMain>

    <AppFooter />
  </UApp>
</template>
