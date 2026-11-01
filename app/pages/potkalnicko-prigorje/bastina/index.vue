<script setup lang="ts">
definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const { atlas, municipalityName, itemPath, categoryLabel, settlementByCode } = useAtlas()

const municipalityFilter = ref<string>('all')
const categoryFilter = ref<string>('all')

const categories = computed(() => {
  const set = new Set(atlas.value.heritage.map(item => item.category))
  return [...set].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), 'hr'))
})

const filtered = computed(() => atlas.value.heritage.filter((item) => {
  if (municipalityFilter.value !== 'all' && item.municipalityId !== municipalityFilter.value) return false
  if (categoryFilter.value !== 'all' && item.category !== categoryFilter.value) return false
  return true
}))

function locationLabel(item: (typeof filtered.value)[number]) {
  const settlement = item.settlementCode ? settlementByCode(item.settlementCode) : undefined
  const parts = [settlement?.name, item.locality].filter(Boolean)
  return parts.length ? parts.join(' · ') : t('pz.heritage.locationPending')
}

useSeoMeta({
  title: () => t('pz.heritage.listTitle'),
  ogTitle: () => `${t('pz.heritage.listTitle')} · Potkalnički zapisi`,
  description: () => t('pz.heritage.listIntro'),
  ogDescription: () => t('pz.heritage.listIntro')
})
</script>

<template>
  <div>
    <UPageHero
      :title="t('pz.heritage.listTitle')"
      :description="t('pz.heritage.listIntro')"
      :ui="{ container: 'py-12 sm:py-16' }"
    />

    <UPageSection :ui="{ root: 'border-t border-default' }">
      <div class="mb-6 flex flex-wrap gap-4">
        <UFormField :label="t('pz.heritage.filterMunicipality')">
          <USelect
            v-model="municipalityFilter"
            :items="[
              { label: t('pz.heritage.filterAll'), value: 'all' },
              ...atlas.municipalities.map(m => ({ label: municipalityName(m.id), value: m.id }))
            ]"
            class="min-w-48"
            data-testid="heritage-filter-municipality"
          />
        </UFormField>
        <UFormField :label="t('pz.heritage.filterCategory')">
          <USelect
            v-model="categoryFilter"
            :items="[
              { label: t('pz.heritage.filterAll'), value: 'all' },
              ...categories.map(c => ({ label: categoryLabel(c), value: c }))
            ]"
            class="min-w-48"
            data-testid="heritage-filter-category"
          />
        </UFormField>
      </div>

      <ul
        class="divide-y divide-default rounded-lg ring ring-default"
        data-testid="heritage-list"
      >
        <li
          v-for="item in filtered"
          :key="item.id"
        >
          <ULink
            v-if="itemPath(item)"
            :to="itemPath(item)"
            class="block px-4 py-3 hover:bg-elevated/40"
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="space-y-1">
                <p class="font-medium text-highlighted">
                  {{ item.name }}
                </p>
                <p class="text-sm text-muted">
                  {{ categoryLabel(item.category) }} · {{ locationLabel(item) }} · {{ municipalityName(item.municipalityId) }}
                </p>
              </div>
              <PzHeritageStatusBadge />
            </div>
          </ULink>
          <div
            v-else
            class="block px-4 py-3"
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="space-y-1">
                <p class="font-medium text-highlighted">
                  {{ item.name }}
                </p>
                <p class="text-sm text-muted">
                  {{ categoryLabel(item.category) }} · {{ locationLabel(item) }} · {{ municipalityName(item.municipalityId) }}
                </p>
              </div>
              <PzHeritageStatusBadge />
            </div>
          </div>
        </li>
      </ul>
    </UPageSection>
  </div>
</template>
