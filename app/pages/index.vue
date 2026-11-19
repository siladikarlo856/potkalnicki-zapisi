<script setup lang="ts">
import type { AtlasOverviewResponse } from '~~/shared/types/publicAtlas'
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const { municipalityPath } = useAtlas()

useSeoMeta({
  title: () => t('pz.home.seoTitle'),
  ogTitle: () => t('pz.home.seoTitle'),
  ogDescription: () => t('pz.home.heroDescription'),
  description: () => t('pz.home.heroDescription')
})

const { data: overview } = await useAtlasFetch<AtlasOverviewResponse>('/api/atlas/overview')

const scopeMunicipalities = computed(() => (overview.value?.municipalities ?? []).map(m => ({
  id: m.id,
  label: m.label,
  to: municipalityPath(m.slug),
  settlements: m.stats.settlements,
  items: m.stats.items
})))
const scopeCount = computed(() => overview.value?.totals)
</script>

<template>
  <div class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-8 px-4 py-6 lg:gap-12 lg:px-12 lg:py-12">
    <section
      class="grid gap-4 rounded-lg border border-default bg-default p-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:p-6"
      data-testid="home-map-card"
      aria-labelledby="home-map-title"
    >
      <div class="flex min-w-0 flex-col gap-3">
        <h2
          id="home-map-title"
          class="pz-h2 text-highlighted"
        >
          Istraži Potkalnički kraj
        </h2>
        <PzSchematicMap
          labels
          label="Shematska karta triju općina i grada Križevaca s grebenom Kalnika"
        />
        <p class="pz-body-sm text-muted">
          {{ scopeCount ? `${scopeCount.municipalities} područja · ${scopeCount.settlements} naselja` : 'Mjesta, naselja i priče podno Kalnika' }}
        </p>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <PzChip
          v-for="row in scopeMunicipalities.slice(0, 4)"
          :key="row.id"
          :to="row.to"
          :count="row.settlements"
        >
          <span class="wrap-anywhere">{{ row.label }}</span>
        </PzChip>
      </div>
    </section>
    <div class="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start lg:gap-12">
      <section
        class="relative flex flex-col gap-3 pt-2 lg:col-span-7 lg:pt-12"
        data-testid="home-hero"
      >
        <p class="pz-overline pz-caption text-muted">
          {{ t('pz.home.heroEyebrow') }}
        </p>
        <h1 class="pz-display text-balance text-highlighted lg:pz-display-lg">
          {{ t('pz.home.heroTitle') }}
        </h1>
        <p class="pz-lead max-w-(--pz-measure) text-muted">
          {{ t('pz.home.heroDescription') }}
        </p>
        <div class="mt-2 hidden flex-wrap items-center gap-3 lg:flex">
          <UButton
            :to="localePath(pzRoutes.places)"
            :label="t('pz.home.exploreCta')"
            icon="i-lucide-compass"
            color="neutral"
            variant="outline"
            size="lg"
            class="ring-(--ui-border-accented)"
          />
          <UButton
            :to="localePath(pzRoutes.about)"
            :label="t('pz.home.aboutCta')"
            trailing-icon="i-lucide-arrow-right"
            color="neutral"
            variant="ghost"
          />
        </div>
        <PzRidge class="mt-2 h-14 w-full lg:mt-6 lg:h-24" />
      </section>

      <div class="min-w-0 lg:col-span-5">
        <HeritageDailyWord
          compact-when-played
          bare
        />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-stretch lg:gap-6">
      <div class="min-w-0">
        <PzLearnPlaySwitch />
      </div>
      <HeritageChallengeHomeSection />
    </div>

    <section
      class="flex flex-col gap-4"
      data-testid="obuhvat"
    >
      <div class="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:justify-between lg:gap-6">
        <h2 class="pz-h2 text-highlighted">
          {{ t('pz.home.scopeTitle') }}
        </h2>
        <p class="pz-body-sm text-muted">
          {{ t('pz.home.scopeDescription') }}
        </p>
      </div>
      <PzMunicipalityList :rows="scopeMunicipalities" />
    </section>

    <section
      id="doprinos"
      class="flex flex-col gap-3 lg:scroll-mt-(--pz-header-h) rounded-(--pz-radius-lg) border border-accented bg-muted p-5 lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-6"
      aria-labelledby="doprinos-title"
      data-testid="doprinos"
    >
      <div class="flex flex-col gap-3 lg:contents">
        <PzStitch class="w-30 lg:hidden" />
        <h2
          id="doprinos-title"
          class="font-serif text-[22px]/7 font-semibold text-highlighted"
        >
          {{ t('pz.home.contributeTitle') }}
        </h2>
        <p class="pz-body text-muted">
          {{ t('pz.home.contributeDescription') }}
        </p>
      </div>
      <UButton
        :to="localePath(pzRoutes.contribute)"
        :label="t('pz.home.contributeCta')"
        icon="i-lucide-pen-line"
        color="neutral"
        variant="outline"
        size="lg"
        class="self-start ring-(--ui-border-accented) print:hidden"
      />
    </section>
  </div>
</template>
