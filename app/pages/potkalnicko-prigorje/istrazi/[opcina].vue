<script setup lang="ts">
import { municipalityBySlug } from '~~/shared/utils/atlasData'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()
const { atlas, municipalityName, municipalityStats, heritageForSettlement, settlementPath, categoryLabel } = useAtlas()

const municipality = computed(() => municipalityBySlug(String(route.params.opcina)))

if (!municipalityBySlug(String(route.params.opcina))) {
  throw createError({ statusCode: 404, statusMessage: 'Općina nije pronađena' })
}

const stats = computed(() => (municipality.value ? municipalityStats(municipality.value.id) : null))

const settlements = computed(() => {
  if (!municipality.value) return []
  return atlas.value.settlements
    .filter(s => s.municipalityId === municipality.value!.id)
    .map(s => ({
      ...s,
      itemCount: heritageForSettlement(s.id).length,
      to: settlementPath(s.slug)
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'hr'))
})

const categoryBreakdown = computed(() => {
  if (!municipality.value) return []
  const counts = new Map<string, number>()
  for (const item of atlas.value.heritage.filter(h => h.municipalityId === municipality.value!.id)) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || categoryLabel(a[0]).localeCompare(categoryLabel(b[0]), 'hr'))
    .map(([category, count]) => ({ category, count, label: categoryLabel(category) }))
})

useSeoMeta({
  title: () => municipality.value ? `${municipalityName(municipality.value.id)} · Potkalnički zapisi` : '',
  description: () => municipality.value && stats.value
    ? t('pz.explore.municipalityDescription', { settlements: stats.value.settlements, items: stats.value.items })
    : ''
})
</script>

<template>
  <div v-if="municipality && stats">
    <UPageHero
      :title="municipalityName(municipality.id)"
      :description="t('pz.explore.municipalityDescription', { settlements: stats.settlements, items: stats.items })"
      :links="[{ label: t('pz.explore.allRegions'), to: localePath('/potkalnicko-prigorje/istrazi'), color: 'neutral', variant: 'ghost' }]"
      :ui="{ container: 'py-12 sm:py-16' }"
    />

    <UPageSection
      v-if="categoryBreakdown.length"
      :title="t('pz.explore.categoriesTitle')"
      :ui="{ root: 'border-t border-default' }"
    >
      <ul class="flex flex-wrap gap-2">
        <li
          v-for="row in categoryBreakdown"
          :key="row.category"
        >
          <UBadge
            variant="subtle"
            :label="`${row.label} · ${row.count}`"
          />
        </li>
      </ul>
    </UPageSection>

    <UPageSection
      :title="t('pz.explore.settlementsTitle')"
      :ui="{ root: 'border-t border-default' }"
    >
      <ul
        class="divide-y divide-default rounded-lg ring ring-default"
        data-testid="settlement-list"
      >
        <li
          v-for="settlement in settlements"
          :key="settlement.id"
        >
          <ULink
            :to="settlement.to"
            class="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm hover:bg-elevated/40"
          >
            <span class="font-medium text-highlighted">{{ settlement.name }}</span>
            <span class="text-muted tabular-nums">
              {{ t('pz.explore.settlementItemCount', { count: settlement.itemCount }) }}
            </span>
          </ULink>
        </li>
      </ul>
    </UPageSection>
  </div>
</template>
