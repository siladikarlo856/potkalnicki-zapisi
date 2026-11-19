<script setup lang="ts">
import type { AtlasMunicipalityResponse, AtlasOverviewResponse } from '~~/shared/types/publicAtlas'
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const { municipalityPath } = useAtlas()
const view = ref<'map' | 'list'>('map')
const settlementQuery = ref('')

useSeoMeta({
  title: () => t('pz.explore.seoTitle'),
  ogTitle: () => `${t('pz.explore.seoTitle')} · Potkalnički zapisi`,
  description: () => t('pz.explore.intro'),
  ogDescription: () => t('pz.explore.intro')
})

const { data: overview } = await useAtlasFetch<AtlasOverviewResponse>('/api/atlas/overview')
const { data: municipalityPages } = await useAsyncData('pz-places-municipality-pages', () => Promise.all((overview.value?.municipalities ?? []).map(async (m) => {
  try {
    return await $fetch<AtlasMunicipalityResponse>(`/api/atlas/municipalities/${m.slug}`)
  } catch {
    return null
  }
})))

// Four equal entries open the hub: places (the list below), Baština, Priče i običaji and Naš govor. The word and
// record counts are not part of the overview, so those two show no number.
const entries = computed(() => [
  { key: 'places', to: `${localePath(pzRoutes.places)}#opcine`, icon: 'i-lucide-map-pin', label: t('pz.explore.entryPlaces'), count: overview.value?.totals.settlements },
  { key: 'heritage', to: localePath(pzRoutes.heritage), icon: 'i-lucide-church', label: t('pz.explore.entryHeritage'), count: overview.value?.totals.items },
  { key: 'intangible', to: localePath(pzRoutes.intangible), icon: 'i-lucide-scroll-text', label: t('pz.explore.entryIntangible'), count: undefined },
  { key: 'speech', to: localePath(pzRoutes.speech), icon: 'i-lucide-book-open', label: t('pz.explore.entrySpeech'), count: undefined }
])

const municipalities = computed(() => (overview.value?.municipalities ?? []).map(m => ({
  id: m.id,
  label: m.label,
  to: municipalityPath(m.slug),
  settlements: m.stats.settlements,
  items: m.stats.items
})))
const settlements = computed(() => (municipalityPages.value ?? []).filter((page): page is AtlasMunicipalityResponse => !!page).flatMap(page => page.settlements.map(s => ({ ...s, municipality: page.municipality.label, to: `${page.municipality.path}${s.slug}/` }))))
const normalizedQuery = computed(() => foldHr(settlementQuery.value.trim()))
const matches = computed(() => normalizedQuery.value
  ? settlements.value.filter(s => foldHr(s.name).includes(normalizedQuery.value)).slice(0, 8)
  : [])
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

    <div
      class="flex flex-wrap gap-2"
      role="group"
      aria-label="Prikaz mjesta"
    >
      <PzChip
        :selected="view === 'map'"
        @click="view = 'map'"
      >
        <UIcon
          name="i-lucide-map"
          aria-hidden="true"
        />Karta
      </PzChip>
      <PzChip
        :selected="view === 'list'"
        @click="view = 'list'"
      >
        <UIcon
          name="i-lucide-list"
          aria-hidden="true"
        />Popis
      </PzChip>
    </div>

    <section
      id="opcine"
      class="grid gap-6 lg:grid-cols-12 lg:gap-12"
    >
      <div
        v-if="view === 'map'"
        class="lg:col-span-7"
      >
        <PzSchematicMap
          labels
          label="Karta: Gornja Rijeka na zapadu, Kalnik na sjeveru, Sveti Petar Orehovec u sredini, Križevci na jugu i istoku"
        />
        <p class="pz-caption mt-2 text-muted">
          Karta je shematska. Dodirni ime ili odaberi kraj s popisa.
        </p>
      </div>
      <div class="flex min-w-0 flex-col gap-4 lg:col-span-5">
        <PzSearchField
          v-model="settlementQuery"
          label="Nađi naselje"
          placeholder="npr. Glogovnica"
        />
        <p
          v-if="normalizedQuery && !matches.length"
          class="pz-body-sm text-muted"
        >
          Nema naselja „{{ settlementQuery.trim() }}”. Arhiv pokriva općine Kalnik, Sveti Petar Orehovec i Gornja Rijeka te grad Križevci.
        </p>
        <PzMunicipalityList
          v-if="!normalizedQuery"
          :rows="municipalities"
        />
        <ul
          v-else-if="matches.length"
          class="divide-y divide-default rounded-lg border border-default bg-default"
        >
          <li
            v-for="settlement in matches"
            :key="settlement.id"
          >
            <NuxtLink
              :to="localePath(settlement.to)"
              class="flex min-h-11 items-center justify-between gap-3 px-4 py-3 no-underline"
            ><span>{{ settlement.name }}</span><span class="pz-caption text-muted">{{ settlement.municipality }}</span></NuxtLink>
          </li>
        </ul>
      </div>
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
