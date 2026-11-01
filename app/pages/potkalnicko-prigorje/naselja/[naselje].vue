<script setup lang="ts">
import { heritageForSettlement, settlementBySlug } from '~~/shared/utils/atlasData'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()
const { atlas, municipalityName, itemPath, categoryLabel } = useAtlas()

const settlement = settlementBySlug(String(route.params.naselje))
if (!settlement) {
  throw createError({ statusCode: 404, statusMessage: 'Naselje nije pronađeno' })
}

const municipality = atlas.value.municipalities.find(m => m.id === settlement.municipalityId)!

const items = heritageForSettlement(settlement.id).map(item => ({
  ...item,
  to: itemPath(item),
  categoryLabel: categoryLabel(item.category)
}))

useSeoMeta({
  title: () => `${settlement.name} · Potkalnički zapisi`,
  description: () => t('pz.explore.settlementPageDescription', {
    name: settlement.name,
    municipality: municipalityName(settlement.municipalityId),
    count: items.length
  })
})
</script>

<template>
  <div>
    <UPageHero
      :title="settlement.name"
      :description="t('pz.explore.settlementPageDescription', {
        name: settlement.name,
        municipality: municipalityName(settlement.municipalityId),
        count: items.length
      })"
      :links="[
        { label: municipalityName(municipality.id), to: localePath(`/potkalnicko-prigorje/istrazi/${municipality.slug}`), color: 'neutral', variant: 'ghost' },
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
            <PzHeritageStatusBadge />
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
            <PzHeritageStatusBadge />
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
