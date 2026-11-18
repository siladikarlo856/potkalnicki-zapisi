<script setup lang="ts">
import type { AtlasThemeResponse } from '~~/shared/types/publicIntangible'
import { pzRoutes } from '~~/shared/utils/appRoutes'

// One theme: its records across Stories, Customs and Folk texts.
definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const { data: payload } = await useAtlasFetch<AtlasThemeResponse>(() => `/api/atlas/themes/${route.params.slug}`)
const theme = computed(() => payload.value?.theme)
const records = computed(() => payload.value?.records ?? [])

const description = computed(() => theme.value?.description?.slice(0, 160) || (theme.value ? t('pz.intangible.theme.seoDescription', { name: theme.value.label }) : ''))

useSeoMeta({
  title: () => theme.value ? t('pz.intangible.theme.seoTitle', { name: theme.value.label }) : '',
  ogTitle: () => theme.value ? `${t('pz.intangible.theme.seoTitle', { name: theme.value.label })} · Potkalnički zapisi` : '',
  description: () => description.value,
  ogDescription: () => description.value
})
</script>

<template>
  <div
    v-if="theme"
    class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-8 px-4 py-6 lg:px-12 lg:py-12"
    data-testid="theme-page"
  >
    <header class="flex max-w-(--pz-measure) flex-col gap-3">
      <PzBackPill :to="localePath(pzRoutes.intangible)">
        {{ t('pz.intangible.title') }}
      </PzBackPill>
      <p class="pz-overline text-muted">
        {{ t('pz.intangible.theme.overline') }}
      </p>
      <h1 class="pz-h1 wrap-anywhere text-highlighted lg:pz-display">
        {{ theme.label }}
      </h1>
      <p
        v-if="theme.description"
        class="pz-body whitespace-pre-line text-muted"
        data-testid="theme-description"
      >
        {{ theme.description }}
      </p>
    </header>

    <section class="flex flex-col gap-4">
      <h2 class="pz-h2 text-highlighted">
        {{ t('pz.intangible.theme.recordsHeading') }}
      </h2>
      <IntangibleRecordList
        v-if="records.length"
        :records="records"
        testid="theme-records"
      />
      <p
        v-else
        class="pz-body text-muted"
        data-testid="theme-empty"
      >
        {{ t('pz.intangible.theme.empty') }}
      </p>
    </section>
  </div>
</template>
