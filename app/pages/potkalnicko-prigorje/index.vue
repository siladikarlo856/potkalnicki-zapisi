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

const discoveryCards = computed(() => [
  { key: 'speech' as const, icon: 'i-lucide-message-circle', soon: false, to: localePath(`${pzRoutes.home}/govor`) },
  { key: 'heritage' as const, icon: 'i-lucide-landmark', soon: false, to: localePath(pzRoutes.heritage) },
  { key: 'places' as const, icon: 'i-lucide-users', soon: false, to: localePath(pzRoutes.explore) },
  { key: 'stories' as const, icon: 'i-lucide-book-heart', soon: true, to: undefined }
])

const scopeMunicipalities = computed(() => (overview.value?.municipalities ?? []).map(m => ({
  id: m.id,
  slug: m.slug,
  ...m.stats,
  to: municipalityPath(m.slug),
  label: m.label
})))
</script>

<template>
  <div>
    <header class="mx-auto max-w-2xl px-4 pb-2 pt-10 sm:pt-14">
      <p class="text-sm font-medium text-muted">
        {{ t('pz.home.heroEyebrow') }}
      </p>
      <h1 class="mt-2 text-3xl font-bold text-balance text-highlighted sm:text-4xl">
        {{ t('pz.home.heroTitle') }}
      </h1>
      <p class="mt-3 max-w-2xl text-muted">
        {{ t('pz.home.heroDescription') }}
      </p>
    </header>

    <HeritageDailyWord compact-when-played />

    <PzLearnPlaySwitch />

    <HeritageChallengeHomeSection />

    <UPageSection
      :title="t('pz.home.scopeTitle')"
      :description="t('pz.home.scopeDescription')"
      :ui="{ root: 'border-t border-default' }"
      data-testid="obuhvat"
    >
      <ul class="divide-y divide-default rounded-lg ring ring-default">
        <li
          v-for="municipality in scopeMunicipalities"
          :key="municipality.id"
        >
          <ULink
            :to="municipality.to"
            class="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm hover:bg-elevated/40"
          >
            <span class="font-medium text-highlighted">{{ municipality.label }}</span>
            <span class="text-muted tabular-nums">{{ t('pz.home.scopeCounts', { settlements: municipality.settlements, items: municipality.items }) }}</span>
          </ULink>
        </li>
      </ul>
    </UPageSection>

    <UPageSection
      :title="t('pz.home.discoveryTitle')"
      :ui="{ root: 'border-t border-default' }"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <UCard
          v-for="card in discoveryCards"
          :key="card.key"
          variant="outline"
          :class="card.to ? 'hover:ring-primary/30' : ''"
        >
          <component
            :is="card.to ? 'ULink' : 'div'"
            :to="card.to"
            class="flex items-start justify-between gap-3"
            :class="card.to ? 'block' : ''"
          >
            <div class="space-y-2">
              <UIcon
                :name="card.icon"
                class="size-6 text-primary"
              />
              <h3 class="text-lg font-semibold text-highlighted">
                {{ t(`pz.home.discovery.${card.key}.title`) }}
              </h3>
              <p class="text-sm text-muted">
                {{ t(`pz.home.discovery.${card.key}.description`) }}
              </p>
            </div>
            <UBadge
              v-if="card.soon"
              :label="t('pz.home.soon')"
              color="neutral"
              variant="subtle"
            />
            <UIcon
              v-else-if="card.to"
              name="i-lucide-arrow-right"
              class="size-5 shrink-0 text-muted"
            />
          </component>
        </UCard>
      </div>
    </UPageSection>

    <UPageSection
      id="doprinos"
      orientation="horizontal"
      :title="t('pz.home.contributeTitle')"
      :description="t('pz.home.contributeDescription')"
      :links="[{ label: t('pz.home.contributeCta'), to: localePath('/potkalnicko-prigorje/doprinesi'), trailingIcon: 'i-lucide-arrow-right', color: 'primary', variant: 'solid', size: 'lg' }]"
      :ui="{ root: 'scroll-mt-(--ui-header-height) border-t border-default', container: 'lg:items-start', footer: 'print:hidden' }"
      data-testid="doprinos"
    />
  </div>
</template>
