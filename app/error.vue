<script setup lang="ts">
import type { NuxtError } from '#app'
import { en, hr } from '@nuxt/ui/locale'

const props = defineProps<{ error: NuxtError }>()
const { locale, localeProperties, t } = useI18n()
const localePath = useLocalePath()

const errorUrl = (props.error as { url?: unknown }).url
const pathname = (typeof errorUrl === 'string' ? errorUrl.split('?')[0] : '') || useRequestURL().pathname
const isAdmin = pathname.startsWith('/admin')
const isPotkalnicko = !isAdmin && !pathname.startsWith('/api')
const layoutName = isAdmin ? 'admin' : 'potkalnicko'
const statusCode = computed(() => props.error.statusCode ?? 500)
const notFound = computed(() => statusCode.value === 404)
const removed = computed(() => statusCode.value === 410)
const unavailable = computed(() => statusCode.value === 503)
const state = computed(() => removed.value ? 'removed' : notFound.value ? 'not-found' : unavailable.value ? 'unavailable' : 'error')
const adminErrorState = computed(() => removed.value ? 'removed' : notFound.value ? 'notFound' : 'generic')
const title = computed(() => ({
  'not-found': 'Ove stranice nema',
  'removed': 'Ovaj je zapis uklonjen',
  'unavailable': 'Arhiv je nakratko nedostupan',
  'error': 'Nešto je pošlo po krivu'
}[state.value]))

const recordSections = new Set(['mjesta', 'bastina', 'osobe', 'price-i-obicaji', 'govor'])
const segments = pathname.split('/').filter(Boolean)
const sectionSegments = segments[0] === 'potkalnicko-prigorje' ? segments.slice(1) : segments
const section = sectionSegments.length > 1 ? sectionSegments[0] : undefined
const sectionList = section && recordSections.has(section) ? `/${section}/` : pzRoutes.places

function retry() {
  clearError({ redirect: pathname })
}

useHead({
  htmlAttrs: { lang: () => localeProperties.value.language },
  title,
  titleTemplate: value => `${value} · ${isAdmin ? 'Administracija' : 'Potkalnički zapisi'}`,
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'robots', content: 'noindex' }
  ],
  link: [{ rel: 'icon', href: '/favicon.svg' }]
})

useThemeColor(isPotkalnicko ? '#FDF9F0' : undefined, isPotkalnicko ? '#14140F' : undefined)
</script>

<template>
  <UApp :locale="locale === 'hr' ? hr : en">
    <SkipLink />
    <NuxtLayout :name="layoutName">
      <UError
        v-if="isAdmin"
        tabindex="-1"
        class="focus:outline-none"
        :error="error"
        :icon="removed ? 'i-lucide-archive-x' : notFound ? 'i-lucide-map-pin-off' : 'i-lucide-triangle-alert'"
        :ui="{ root: 'px-4 py-16', links: 'flex-wrap gap-3 print:hidden' }"
      >
        <template #statusMessage>
          {{ t(`error.${adminErrorState}.title`) }}
        </template>

        <template #message>
          {{ t(`error.${adminErrorState}.description`) }}
        </template>

        <template #links>
          <UButton
            :label="removed ? t('error.removed.back') : t('error.home')"
            icon="i-lucide-house"
            :to="removed ? sectionList : '/admin'"
            size="lg"
          />
        </template>
      </UError>

      <PageState
        v-else
        :kind="state"
        :title="title"
        @retry="retry"
      >
        <template #actions>
          <UButton
            v-if="removed"
            :to="localePath(sectionList)"
            label="Pregledaj baštinu"
            icon="i-lucide-list"
          />
          <UButton
            v-else-if="notFound"
            :to="localePath(pzRoutes.places)"
            label="Otvori arhiv"
          />
          <UButton
            v-else
            label="Pokušaj ponovno"
            icon="i-lucide-refresh-cw"
            @click="retry"
          />
          <UButton
            v-if="removed"
            :to="localePath(pzRoutes.contribute)"
            label="Dodaj izvor"
            icon="i-lucide-book-plus"
            color="neutral"
            variant="outline"
          />
          <UButton
            v-else-if="notFound"
            to="/"
            label="Na početnu"
            color="neutral"
            variant="ghost"
          />
          <UButton
            v-else-if="!unavailable"
            :to="localePath(pzRoutes.about)"
            label="Javi grešku"
            color="neutral"
            variant="ghost"
          />
        </template>
      </PageState>
    </NuxtLayout>
  </UApp>
</template>
