<script setup lang="ts">
import type { AtlasOverviewResponse } from '~~/shared/types/publicAtlas'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const { municipalityPath } = useAtlas()

useSeoMeta({
  title: () => t('pz.explore.seoTitle'),
  ogTitle: () => `${t('pz.explore.seoTitle')} · Potkalnički zapisi`,
  description: () => t('pz.explore.intro'),
  ogDescription: () => t('pz.explore.intro')
})

const { data: overview } = await useAtlasFetch<AtlasOverviewResponse>('/api/atlas/overview')

const regions = computed(() => (overview.value?.municipalities ?? []).map(m => ({
  ...m,
  label: m.label,
  stats: m.stats,
  to: municipalityPath(m.slug)
})))
</script>

<template>
  <div>
    <UPageHero
      :title="t('pz.explore.title')"
      :description="t('pz.explore.intro')"
      :ui="{ container: 'py-12 sm:py-16' }"
    />

    <UPageSection :ui="{ root: 'border-t border-default' }">
      <ul
        class="divide-y divide-default rounded-lg ring ring-default"
        data-testid="municipality-list"
      >
        <li
          v-for="region in regions"
          :key="region.id"
        >
          <ULink
            :to="region.to"
            class="flex flex-wrap items-baseline justify-between gap-2 px-4 py-4 text-sm hover:bg-elevated/40"
          >
            <span class="font-medium text-highlighted">{{ region.label }}</span>
            <span class="text-muted tabular-nums">
              {{ t('pz.home.regionCounts', { settlements: region.stats.settlements, items: region.stats.items }) }}
            </span>
          </ULink>
        </li>
      </ul>
    </UPageSection>
  </div>
</template>
