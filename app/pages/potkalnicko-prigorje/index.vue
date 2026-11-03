<script setup lang="ts">
import { pzRoutes } from '~~/shared/utils/appRoutes'

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

const { municipalityName, municipalityPath, municipalityStats, atlas } = useAtlas()

const discoveryCards = computed(() => [
  { key: 'speech' as const, icon: 'i-lucide-message-circle', soon: true, to: undefined },
  { key: 'heritage' as const, icon: 'i-lucide-landmark', soon: false, to: localePath(pzRoutes.heritage) },
  { key: 'places' as const, icon: 'i-lucide-users', soon: false, to: localePath(pzRoutes.explore) },
  { key: 'stories' as const, icon: 'i-lucide-book-heart', soon: true, to: undefined }
])

const regions = computed(() => atlas.value.municipalities.map(m => ({
  id: m.id,
  slug: m.slug,
  ...municipalityStats(m.id),
  to: municipalityPath(m.slug),
  label: municipalityName(m.id)
})))
</script>

<template>
  <div>
    <UPageHero
      :title="t('pz.home.heroTitle')"
      :links="[
        { label: t('pz.home.playCta'), to: localePath('/potkalnicko-prigorje/igre'), trailingIcon: 'i-lucide-arrow-right', color: 'primary', variant: 'solid', size: 'xl' },
        { label: t('pz.home.exploreCta'), to: localePath(pzRoutes.explore), icon: 'i-lucide-map', color: 'neutral', variant: 'outline', size: 'xl' },
        { label: t('challenge.friendTitle'), to: localePath('/potkalnicko-prigorje/izazov'), icon: 'i-lucide-swords', color: 'neutral', variant: 'ghost', size: 'lg' }
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
      <HeritageDailyWord />

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
      :title="t('pz.home.regionsTitle')"
      :description="t('pz.home.regionsDescription')"
      :ui="{ root: 'border-t border-default' }"
      data-testid="pet-podrucja"
    >
      <ul class="divide-y divide-default rounded-lg ring ring-default">
        <li
          v-for="region in regions"
          :key="region.id"
        >
          <ULink
            :to="region.to"
            class="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm hover:bg-elevated/40"
          >
            <span class="font-medium text-highlighted">{{ region.label }}</span>
            <span class="text-muted tabular-nums">{{ t('pz.home.regionCounts', { settlements: region.settlements, items: region.items }) }}</span>
          </ULink>
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
