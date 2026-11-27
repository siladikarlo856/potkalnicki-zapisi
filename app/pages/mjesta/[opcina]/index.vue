<script setup lang="ts">
import type { AtlasMunicipalityResponse, AtlasOverviewResponse } from '~~/shared/types/publicAtlas'
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()
const { municipalityPath } = useAtlas()
const { settlementCard } = usePlaceCards()
const settlementQuery = ref('')

const municipalitySlug = computed(() => String(route.params.opcina))
const { data: page } = await useAtlasFetch<AtlasMunicipalityResponse>(
  () => `/api/atlas/municipalities/${municipalitySlug.value}`
)
// The neighbours on the map, named and one click away; without them the map still shows this unit.
const { data: overview } = await useFetch<AtlasOverviewResponse>('/api/atlas/overview')

const proposalOpen = ref(false)
const municipality = computed(() => page.value?.municipality)
const stats = computed(() => page.value?.stats)
const persons = computed(() => page.value?.persons ?? [])
const intangible = computed(() => page.value?.intangible ?? [])

const areas = computed(() => {
  const current = municipality.value
  const all = (overview.value?.municipalities ?? []).map(m => ({ slug: m.slug, name: m.name, to: municipalityPath(m.slug) }))
  if (!current || all.some(area => area.slug === current.slug)) return all
  return [...all, { slug: current.slug, name: current.name }]
})
const settlements = computed(() => [...(page.value?.settlements ?? [])].sort((a, b) => compareHr(a.name, b.name)))
const cards = computed(() => matchPlaces(settlements.value, settlementQuery.value, s => s.name)
  .map(s => settlementCard(s, municipalitySlug.value)))

// Baština has its own page: the unit's records open there, filtered to this unit.
const heritageTo = computed(() => `${localePath(pzRoutes.heritage)}?opcina=${encodeURIComponent(municipalitySlug.value)}`)
const contributeTypes = usePzContributeTypes(() => ({ municipality: municipalitySlug.value }))

useSeoMeta({
  title: () => municipality.value ? `${municipality.value.label} · Potkalnički zapisi` : '',
  description: () => stats.value
    ? t('pz.explore.municipalityDescription', { settlements: stats.value.settlements, items: stats.value.items })
    : ''
})
</script>

<template>
  <div
    v-if="municipality && stats"
    class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-8 px-4 py-6 lg:px-12 lg:py-12"
    data-testid="municipality-page"
  >
    <header class="flex max-w-(--pz-measure) flex-col gap-3">
      <PzBackPill :to="localePath(pzRoutes.places)">
        {{ t('pz.explore.allRegions') }}
      </PzBackPill>
      <h1 class="pz-h1 wrap-anywhere text-highlighted lg:pz-display">
        {{ municipality.label }}
      </h1>
      <dl
        class="flex gap-8"
        data-testid="municipality-stats"
      >
        <div>
          <dt class="pz-caption text-muted">
            {{ t('pz.explore.statSettlements') }}
          </dt>
          <dd class="pz-numeral m-0 text-highlighted">
            {{ stats.settlements }}
          </dd>
        </div>
        <div>
          <dt class="pz-caption text-muted">
            {{ t('pz.explore.statItems') }}
          </dt>
          <dd class="pz-numeral m-0 text-highlighted">
            {{ stats.items }}
          </dd>
        </div>
      </dl>
    </header>

    <section aria-labelledby="settlements-title">
      <h2
        id="settlements-title"
        class="sr-only"
      >
        {{ t('pz.explore.settlementsList') }}
      </h2>
      <PzPlaceExplorer
        v-model:query="settlementQuery"
        :areas="areas"
        :cards="cards"
        :selected="municipality.slug"
        :map-label="t('pz.explore.unitMapLabel', { name: municipality.label })"
        :search-label="t('pz.explore.findSettlement')"
        :list-label="t('pz.explore.settlementsList')"
        list-testid="settlement-list"
        :empty-text="t('pz.explore.noSettlementMatch', { query: settlementQuery.trim() })"
        :collapse-after="12"
        :show-all-label="t('pz.explore.showAllSettlements', { count: cards.length })"
      />
    </section>

    <div class="grid gap-4 lg:grid-cols-2">
      <PzTile
        v-if="stats.items"
        :to="heritageTo"
        icon="i-lucide-church"
        :name="t('pz.explore.heritageTileTitle')"
        :line="t('pz.explore.heritageTileLine')"
        variant="link"
        data-testid="municipality-heritage-link"
      />
      <PzEmptyState
        v-else
        :title="t('pz.explore.emptyHeritageTitle', { name: municipality.label })"
        :contribute-types="contributeTypes"
      />
      <PzGameCard
        :title="t('pz.explore.playSettlements')"
        :blurb="t('pz.explore.playSettlementsBlurb')"
        :to="localePath(pzRoutes.selaOpcine)"
        icon="i-lucide-map-pin"
        :level="2"
      />
    </div>

    <section
      v-if="persons.length"
      class="flex flex-col gap-4"
    >
      <h2 class="pz-h2 text-highlighted">
        {{ t('pz.persons.fromThisPlace') }}
      </h2>
      <PersonsList
        :persons="persons"
        testid="municipality-persons"
      />
    </section>

    <section
      v-if="intangible.length"
      class="flex flex-col gap-4 lg:max-w-(--pz-measure)"
    >
      <h2 class="pz-h2 text-highlighted">
        {{ t('pz.intangible.fromThisPlace') }}
      </h2>
      <IntangibleRefList
        :records="intangible"
        testid="municipality-intangible"
      />
    </section>

    <div class="flex flex-col gap-3">
      <UButton
        :label="t('pz.heritage.missingItem')"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        class="min-h-(--pz-tap-min) max-w-full justify-start self-start text-start whitespace-normal ring-(--ui-border-accented)"
        aria-haspopup="dialog"
        data-testid="municipality-suggest-item"
        @click="proposalOpen = true"
      />
      <HeritageSuggestDialog
        v-model:open="proposalOpen"
        kind="heritage_item"
        mode="proposal"
        :prefill="{ municipalityId: municipality.id }"
      />
    </div>
  </div>
</template>
