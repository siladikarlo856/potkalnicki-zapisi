<script setup lang="ts">
import { PZ_MUNICIPALITY_IDS, PZ_MUNICIPALITY_STATS } from '~~/shared/data/pzMunicipalities'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('pz.home.seoTitle'),
  ogTitle: () => t('pz.home.seoTitle'),
  ogDescription: () => t('pz.home.heroDescription'),
  description: () => t('pz.home.heroDescription')
})

const discoveryCards = computed(() => [
  { key: 'speech', icon: 'i-lucide-message-circle', soon: true },
  { key: 'heritage', icon: 'i-lucide-landmark', soon: true },
  { key: 'places', icon: 'i-lucide-users', soon: true },
  { key: 'stories', icon: 'i-lucide-book-heart', soon: true }
] as const)

const regions = computed(() => PZ_MUNICIPALITY_IDS.map(id => ({
  id,
  ...PZ_MUNICIPALITY_STATS[id]
})))
</script>

<template>
  <div>
    <UPageHero
      :title="t('pz.home.heroTitle')"
      :links="[
        { label: t('pz.home.playCta'), to: localePath('/potkalnicko-prigorje/igre'), trailingIcon: 'i-lucide-arrow-right', color: 'primary', variant: 'solid', size: 'xl' },
        { label: t('challenge.friendTitle'), to: localePath('/potkalnicko-prigorje/izazov'), icon: 'i-lucide-swords', color: 'neutral', variant: 'outline', size: 'xl' }
      ]"
      :ui="{ container: 'py-16 sm:py-24 lg:py-28', title: 'text-4xl sm:text-5xl lg:text-6xl', footer: 'print:hidden' }"
    >
      <template #headline>
        <span class="text-sm font-medium text-muted">{{ t('pz.home.heroEyebrow') }}</span>
      </template>
      <template #description>
        <span class="mt-4 block max-w-2xl">{{ t('pz.home.heroDescription') }}</span>
      </template>
    </UPageHero>

    <UPageSection
      :title="t('pz.home.discoveryTitle')"
      :ui="{ root: 'border-t border-default' }"
    >
      <UCard
        variant="soft"
        class="mb-4"
        data-testid="daily-word-soon"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-2">
            <div class="flex flex-wrap gap-2">
              <UBadge
                :label="t('pz.home.dailyWord')"
                variant="subtle"
              />
              <UBadge
                :label="t('pz.home.soon')"
                color="neutral"
                variant="subtle"
              />
            </div>
            <p class="text-sm text-muted">
              {{ t('pz.home.dailyWordHint') }}
            </p>
          </div>
        </div>
      </UCard>

      <div class="grid gap-4 sm:grid-cols-2">
        <UCard
          v-for="card in discoveryCards"
          :key="card.key"
          variant="outline"
        >
          <div class="flex items-start justify-between gap-3">
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
              :label="t('pz.home.soon')"
              color="neutral"
              variant="subtle"
            />
          </div>
        </UCard>
      </div>
    </UPageSection>

    <UPageSection
      :title="t('pz.home.regionsTitle')"
      :description="t('pz.home.regionsDescription')"
      :ui="{ root: 'border-t border-default' }"
      data-testid="pet-podrucja"
    >
      <ul class="divide-y divide-default rounded-lg ring ring-default">
        <li
          v-for="region in regions"
          :key="region.id"
          class="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm"
        >
          <span class="font-medium text-highlighted">{{ t(`pz.municipalities.${region.id}`) }}</span>
          <span class="text-muted tabular-nums">{{ t('pz.home.regionCounts', { settlements: region.settlements, items: region.items }) }}</span>
        </li>
      </ul>
    </UPageSection>

    <UPageSection
      id="doprinos"
      orientation="horizontal"
      :title="t('pz.home.contributeTitle')"
      :description="t('pz.home.contributeDescription')"
      :links="[{ label: t('pz.home.contributeCta'), to: localePath('/potkalnicko-prigorje/doprinesi'), trailingIcon: 'i-lucide-arrow-right', color: 'primary', variant: 'solid', size: 'lg' }]"
      :ui="{ root: 'scroll-mt-(--ui-header-height) border-t border-default', container: 'lg:items-start', footer: 'print:hidden' }"
    />
  </div>
</template>
