<script setup lang="ts">
import type { AtlasOverviewResponse } from '~~/shared/types/publicAtlas'
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const { municipalityPath } = useAtlas()

useSeoMeta({
  title: () => t('pz.explore.seoTitle'),
  ogTitle: () => `${t('pz.explore.seoTitle')} · Potkalnički zapisi`,
  description: () => t('pz.explore.intro'),
  ogDescription: () => t('pz.explore.intro')
})

const { data: overview } = await useAtlasFetch<AtlasOverviewResponse>('/api/atlas/overview')

// Three equal entries open the hub: places (the list below), Baština and Naš govor. The word count is
// not part of the overview, so Naš govor shows no number.
const entries = computed(() => [
  { key: 'places', to: `${localePath(pzRoutes.explore)}#opcine`, icon: 'i-lucide-map-pin', label: t('pz.explore.entryPlaces'), count: overview.value?.totals.settlements },
  { key: 'heritage', to: localePath(pzRoutes.heritage), icon: 'i-lucide-church', label: t('pz.explore.entryHeritage'), count: overview.value?.totals.items },
  { key: 'speech', to: localePath(`${pzRoutes.home}/govor`), icon: 'i-lucide-book-open', label: t('pz.explore.entrySpeech'), count: undefined }
])

const municipalities = computed(() => (overview.value?.municipalities ?? []).map(m => ({
  ...m,
  label: m.label,
  stats: m.stats,
  to: municipalityPath(m.slug)
})))
</script>

<template>
  <div>
    <UPageHero
      :title="t('pz.explore.hubTitle')"
      :description="t('pz.explore.hubIntro', { municipalities: overview?.totals.municipalities ?? 5, settlements: overview?.totals.settlements ?? 0 })"
      :ui="{ container: 'py-8 sm:py-12', title: 'pz-display', description: 'pz-body' }"
    />

    <UPageSection
      :ui="{ container: 'py-0 sm:py-0 lg:py-0' }"
    >
      <div
        class="grid grid-cols-3 gap-2 lg:gap-4"
        data-testid="explore-entries"
      >
        <NuxtLink
          v-for="entry in entries"
          :key="entry.key"
          :to="entry.to"
          :data-entry="entry.key"
          class="flex min-h-28 flex-col items-center gap-1 rounded-(--pz-radius-lg) border border-default bg-default p-3 text-center hover:bg-muted"
        >
          <span class="grid size-10 place-items-center rounded-(--pz-radius-md) bg-accented text-primary">
            <UIcon
              :name="entry.icon"
              class="size-5"
              aria-hidden="true"
            />
          </span>
          <b class="pz-label text-default">{{ entry.label }}</b>
          <span class="pz-caption min-h-[18px] text-muted tabular-nums">{{ entry.count ?? '' }}</span>
        </NuxtLink>
      </div>
    </UPageSection>

    <UPageSection
      id="opcine"
      :title="t('pz.explore.municipalitiesTitle')"
      :ui="{ root: 'scroll-mt-(--pz-header-h)', title: 'pz-h2 text-left' }"
    >
      <ul
        class="divide-y divide-default rounded-lg ring ring-default"
        data-testid="municipality-list"
      >
        <li
          v-for="municipality in municipalities"
          :key="municipality.id"
        >
          <ULink
            :to="municipality.to"
            class="flex flex-wrap items-baseline justify-between gap-2 px-4 py-4 text-sm hover:bg-elevated/40"
          >
            <span class="font-medium text-highlighted">{{ municipality.label }}</span>
            <span class="text-muted tabular-nums">
              {{ t('pz.home.scopeCounts', { settlements: municipality.stats.settlements, items: municipality.stats.items }) }}
            </span>
          </ULink>
        </li>
      </ul>
    </UPageSection>
  </div>
</template>
