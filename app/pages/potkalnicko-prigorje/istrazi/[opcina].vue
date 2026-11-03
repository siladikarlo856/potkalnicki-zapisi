<script setup lang="ts">
import type { AtlasMunicipalityResponse } from '~~/shared/types/publicAtlas'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()
const { settlementPath } = useAtlas()

const municipalitySlug = computed(() => String(route.params.opcina))
const { data: page } = await useAtlasFetch<AtlasMunicipalityResponse>(
  () => `/api/atlas/municipalities/${municipalitySlug.value}`
)

const proposalOpen = ref(false)
const municipality = computed(() => page.value?.municipality)
const stats = computed(() => page.value?.stats)

const settlements = computed(() => (page.value?.settlements ?? []).map(s => ({
  ...s,
  to: settlementPath(s.slug)
})).sort((a, b) => a.name.localeCompare(b.name, 'hr')))

const categoryBreakdown = computed(() => page.value?.categories ?? [])

useSeoMeta({
  title: () => municipality.value ? `${municipality.value.label} · Potkalnički zapisi` : '',
  description: () => stats.value
    ? t('pz.explore.municipalityDescription', { settlements: stats.value.settlements, items: stats.value.items })
    : ''
})
</script>

<template>
  <div v-if="municipality && stats">
    <UPageHero
      :title="municipality.label"
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
          :key="row.key"
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

    <UPageSection :ui="{ root: 'border-t border-default' }">
      <UButton
        :label="t('pz.heritage.missingItem')"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
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
    </UPageSection>
  </div>
</template>
