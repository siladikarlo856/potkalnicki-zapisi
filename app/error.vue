<script setup lang="ts">
import type { NuxtError } from '#app'
import { en, hr } from '@nuxt/ui/locale'

const props = defineProps<{ error: NuxtError }>()

const { locale, localeProperties, t } = useI18n()
// Nuxt sets `url` on the error at runtime (the SSR request path), but NuxtError does not type it.
const errorUrl = (props.error as { url?: unknown }).url
const pathname = (typeof errorUrl === 'string' ? errorUrl.split('?')[0] : '') || useRequestURL().pathname
const isAdmin = pathname.startsWith('/admin')
const isPotkalnicko = !isAdmin && !pathname.startsWith('/api')
const layoutName = isAdmin ? 'admin' : 'potkalnicko'

const notFound = computed(() => props.error.statusCode === 404)
const removed = computed(() => props.error.statusCode === 410)
const state = computed(() => removed.value ? 'removed' : notFound.value ? 'notFound' : 'generic')
const title = computed(() => t(`error.${state.value}.title`))
// A removed record points back to the list of its section, or the places list. An old
// /potkalnicko-prigorje/... address is read without that prefix; `naselja` and unknown sections fall back.
const recordSections = new Set(['mjesta', 'bastina', 'osobe', 'price-i-obicaji', 'govor'])
const segments = pathname.split('/').filter(Boolean)
const sectionSegments = segments[0] === 'potkalnicko-prigorje' ? segments.slice(1) : segments
const section = sectionSegments.length > 1 ? sectionSegments[0] : undefined
const sectionList = section && recordSections.has(section) ? `/${section}/` : '/mjesta/'

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
    { rel: 'icon', href: '/favicon.svg' }
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
        :icon="removed ? 'i-lucide-archive-x' : notFound ? 'i-lucide-map-pin-off' : 'i-lucide-triangle-alert'"
        :ui="{ root: 'px-4 py-16', links: 'flex-wrap gap-3 print:hidden' }"
      >
        <template #statusMessage>
          {{ title }}
        </template>

        <template #message>
          {{ t(`error.${state}.description`) }}
        </template>

        <template #links>
          <UButton
            v-if="removed"
            :label="t('error.removed.back')"
            icon="i-lucide-list"
            :to="sectionList"
            size="lg"
          />
          <UButton
            v-else
            :label="t('error.home')"
            icon="i-lucide-house"
            :to="isAdmin ? '/admin' : '/'"
            size="lg"
          />
        </template>
      </UError>
    </NuxtLayout>
  </UApp>
</template>
