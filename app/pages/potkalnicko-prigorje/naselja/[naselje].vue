<script setup lang="ts">
import type { AtlasSettlementResponse } from '~~/shared/types/publicAtlas'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const settlementSlug = computed(() => String(route.params.naselje))
const { data: page } = await useAtlasFetch<AtlasSettlementResponse>(
  () => `/api/atlas/settlements/${settlementSlug.value}`
)

const settlement = computed(() => page.value?.settlement)
const municipality = computed(() => page.value?.municipality)

const items = computed(() => (page.value?.items ?? []).map(item => ({
  ...item,
  to: item.path ? localePath(item.path) : undefined,
  categoryLabel: item.category.label
})))

useSeoMeta({
  title: () => settlement.value ? `${settlement.value.name} · Potkalnički zapisi` : '',
  description: () => settlement.value && municipality.value
    ? t('pz.explore.settlementPageDescription', {
        name: settlement.value.name,
        municipality: municipality.value.label,
        count: items.value.length
      })
    : ''
})
</script>

<template>
  <div v-if="settlement && municipality">
    <UPageHero
      :title="settlement.name"
      :description="t('pz.explore.settlementPageDescription', {
        name: settlement.name,
        municipality: municipality.label,
        count: items.length
      })"
      :links="[
        { label: municipality.label, to: localePath(`/potkalnicko-prigorje/istrazi/${municipality.slug}`), color: 'neutral', variant: 'ghost' },
        { label: t('pz.explore.allRegions'), to: localePath('/potkalnicko-prigorje/istrazi'), color: 'neutral', variant: 'ghost' }
      ]"
      :ui="{ container: 'py-12 sm:py-16' }"
    />

    <UPageSection
      :title="t('pz.heritage.settlementItemsTitle')"
      :ui="{ root: 'border-t border-default' }"
    >
      <ul
        v-if="items.length"
        class="divide-y divide-default rounded-lg ring ring-default"
        data-testid="settlement-heritage-list"
      >
        <li
          v-for="item in items"
          :key="item.id"
        >
          <ULink
            v-if="item.to"
            :to="item.to"
            class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-elevated/40"
          >
            <span>
              <span class="font-medium text-highlighted">{{ item.name }}</span>
              <span class="ml-2 text-muted">{{ item.categoryLabel }}</span>
            </span>
            <PzHeritageStatusBadge :verification="item.verification" />
          </ULink>
          <div
            v-else
            class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <span>
              <span class="font-medium text-highlighted">{{ item.name }}</span>
              <span
                v-if="item.locality"
                class="ml-1 text-muted"
              >({{ item.locality }})</span>
            </span>
            <PzHeritageStatusBadge :verification="item.verification" />
          </div>
        </li>
      </ul>
      <p
        v-else
        class="text-sm text-muted"
      >
        {{ t('pz.heritage.emptySettlement') }}
      </p>
    </UPageSection>
  </div>
</template>
