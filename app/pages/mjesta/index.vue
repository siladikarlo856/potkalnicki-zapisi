<script setup lang="ts">
import type { AtlasOverviewResponse } from '~~/shared/types/publicAtlas'
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('pz.explore.seoTitle'),
  ogTitle: () => `${t('pz.explore.seoTitle')} · Potkalnički zapisi`,
  description: () => t('pz.explore.intro'),
  ogDescription: () => t('pz.explore.intro')
})

const { data: overview } = await useAtlasFetch<AtlasOverviewResponse>('/api/atlas/overview')

// Four equal entries open the hub: places (the explorer above), Baština, Priče i običaji and Naš govor. The word and
// record counts are not part of the overview, so those two show no number.
const entries = computed(() => [
  { key: 'places', to: `${localePath(pzRoutes.places)}#opcine`, icon: 'i-lucide-map-pin', label: t('pz.explore.entryPlaces'), count: overview.value?.totals.settlements },
  { key: 'heritage', to: localePath(pzRoutes.heritage), icon: 'i-lucide-church', label: t('pz.explore.entryHeritage'), count: overview.value?.totals.items },
  { key: 'intangible', to: localePath(pzRoutes.intangible), icon: 'i-lucide-scroll-text', label: t('pz.explore.entryIntangible'), count: undefined },
  { key: 'speech', to: localePath(pzRoutes.speech), icon: 'i-lucide-book-open', label: t('pz.explore.entrySpeech'), count: undefined }
])
</script>

<template>
  <div class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-8 px-4 py-6 lg:gap-12 lg:px-12 lg:py-12">
    <header class="flex max-w-(--pz-measure) flex-col gap-3">
      <h1 class="pz-display text-highlighted lg:pz-display-lg">
        {{ t('pz.explore.hubTitle') }}
      </h1>
      <p class="pz-lead text-muted">
        {{ t('pz.explore.hubIntro', { municipalities: overview?.totals.municipalities ?? 5, settlements: overview?.totals.settlements ?? 0 }) }}
      </p>
    </header>

    <section
      id="opcine"
      aria-labelledby="opcine-title"
    >
      <h2
        id="opcine-title"
        class="sr-only"
      >
        {{ t('pz.explore.placesList') }}
      </h2>
      <PlacesRegionExplorer :overview="overview" />
    </section>

    <section
      class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-4"
      :aria-label="t('pz.explore.entriesLabel')"
      data-testid="explore-entries"
    >
      <NuxtLink
        v-for="entry in entries"
        :key="entry.key"
        :to="entry.to"
        :data-entry="entry.key"
        class="flex min-h-28 flex-col items-center gap-1 rounded-(--pz-radius-lg) border border-default bg-default p-3 text-center no-underline hover:border-accented hover:bg-muted"
      >
        <span class="grid size-10 place-items-center rounded-(--pz-radius-md) bg-accented text-primary">
          <UIcon
            :name="entry.icon"
            class="size-5"
            aria-hidden="true"
          />
        </span>
        <b class="pz-label text-default">{{ entry.label }}</b>
        <span class="pz-caption min-h-[18px] font-normal text-muted tabular-nums">{{ entry.count ?? '' }}</span>
      </NuxtLink>
    </section>
  </div>
</template>
