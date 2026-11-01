<script setup lang="ts">
import type { NuxtError } from '#app'
import { en, hr } from '@nuxt/ui/locale'

const props = defineProps<{ error: NuxtError }>()

const { locale, localeProperties, t } = useI18n()
const localePath = useLocalePath()
const isPotkalnicko = useRequestURL().pathname.startsWith('/potkalnicko-prigorje')
const layoutName = isPotkalnicko ? 'potkalnicko' : 'default'

const notFound = computed(() => props.error.statusCode === 404)
const title = computed(() => notFound.value ? t('error.notFound.title') : t('error.generic.title'))

useHead({
  // Same BCP 47 tag (hr-HR / en-GB) that app.vue gets from useLocaleHead.
  htmlAttrs: { lang: () => localeProperties.value.language },
  title,
  titleTemplate: value => `${value} · ${isPotkalnicko ? 'Potkalnički zapisi' : 'Karlo Siladi'}`,
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'robots', content: 'noindex' }
  ],
  link: [
    { rel: 'icon', href: isPotkalnicko ? '/potkalnicko-prigorje/favicon.svg' : '/favicon.ico' }
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
            :to="isPotkalnicko ? '/potkalnicko-prigorje' : localePath('/')"
            size="lg"
          />
          <UButton
            v-if="!isPotkalnicko"
            :label="t('error.heritage')"
            trailing-icon="i-lucide-arrow-right"
            color="neutral"
            variant="subtle"
            to="/potkalnicko-prigorje"
            size="lg"
          />
        </template>
      </UError>
    </NuxtLayout>
  </UApp>
</template>
