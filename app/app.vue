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

const { locale } = useI18n()
const i18nHead = useLocaleHead()

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ]
})

useHead(() => ({
  htmlAttrs: { lang: i18nHead.value.htmlAttrs.lang },
  link: i18nHead.value.link,
  meta: i18nHead.value.meta
}))
</script>

<template>
  <UApp :locale="locale === 'hr' ? hr : en">
    <NuxtRouteAnnouncer />
    <SkipLink />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
