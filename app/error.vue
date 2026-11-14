<script setup lang="ts">
import type { NuxtError } from '#app'
import { en, hr } from '@nuxt/ui/locale'

const props = defineProps<{ error: NuxtError }>()

const { locale, localeProperties, t } = useI18n()
// Nuxt sets `url` on the error at runtime (the SSR request path), but NuxtError does not type it.
const errorUrl = (props.error as { url?: unknown }).url
const pathname = (typeof errorUrl === 'string' ? errorUrl.split('?')[0] : '') || useRequestURL().pathname
const isPotkalnicko = pathname.startsWith('/potkalnicko-prigorje')
const isAdmin = pathname.startsWith('/admin')
const layoutName = isAdmin ? 'admin' : 'potkalnicko'

const notFound = computed(() => props.error.statusCode === 404)
const title = computed(() => notFound.value ? t('error.notFound.title') : t('error.generic.title'))

useHead({
  // Same BCP 47 tag (hr-HR / en-GB) that app.vue gets from useLocaleHead.
  htmlAttrs: { lang: () => localeProperties.value.language },
  title,
  titleTemplate: value => `${value} · ${isAdmin ? 'Administracija' : 'Potkalnički zapisi'}`,
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'robots', content: 'noindex' }
  ],
  link: [
    { rel: 'icon', href: '/potkalnicko-prigorje/favicon.svg' }
  ]
})

useThemeColor(isPotkalnicko ? '#FDF9F0' : undefined, isPotkalnicko ? '#14140F' : undefined)
</script>

<template>
  <UApp :locale="locale === 'hr' ? hr : en">
    <SkipLink />
    <NuxtLayout :name="layoutName">
      <UError
        tabindex="-1"
        class="focus:outline-none"
        :error="error"
        :icon="notFound ? 'i-lucide-map-pin-off' : 'i-lucide-triangle-alert'"
        :ui="{ root: 'px-4 py-16', links: 'flex-wrap gap-3 print:hidden' }"
      >
        <template #statusMessage>
          {{ title }}
        </template>

        <template #message>
          {{ notFound ? t('error.notFound.description') : t('error.generic.description') }}
        </template>

        <template #links>
          <UButton
            :label="t('error.home')"
            icon="i-lucide-house"
            :to="isAdmin ? '/admin' : '/potkalnicko-prigorje'"
            size="lg"
          />
        </template>
      </UError>
    </NuxtLayout>
  </UApp>
</template>
