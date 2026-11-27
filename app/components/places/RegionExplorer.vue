<script setup lang="ts">
// The whole region in the place explorer (Početna, Mjesta): every town and municipality on the area map and as a
// card, and a search that finds the units and settlements by name across the region.
import type { AtlasOverviewResponse } from '~~/shared/types/publicAtlas'

const props = defineProps<{
  overview: AtlasOverviewResponse | null | undefined
}>()

const { t } = useI18n()
const { query, areas, cards, loading } = useRegionExplorer(() => props.overview)

const mapLabel = computed(() => t('pz.explore.regionMapLabel', {
  names: (props.overview?.municipalities ?? []).map(m => m.label).join(', ')
}))
</script>

<template>
  <PzPlaceExplorer
    v-model:query="query"
    :areas="areas"
    :cards="cards"
    :map-label="mapLabel"
    :search-label="t('pz.explore.findPlace')"
    :list-label="t('pz.explore.placesList')"
    list-testid="municipality-list"
    :loading="loading"
    :loading-text="t('pz.explore.placesLoading')"
    :empty-text="t('pz.explore.noPlaceMatch', { query: query.trim() })"
  />
</template>
