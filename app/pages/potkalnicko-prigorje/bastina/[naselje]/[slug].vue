<script setup lang="ts">
import { heritageItemByRoute } from '~~/shared/utils/atlasData'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()
const { atlas, municipalityName, categoryLabel, settlementByCode } = useAtlas()

const item = heritageItemByRoute(String(route.params.naselje), String(route.params.slug))
if (!item) {
  throw createError({ statusCode: 404, statusMessage: 'Zapis nije pronađen' })
}
const heritageItem = item

const settlement = settlementByCode(heritageItem.settlementCode!)!
const municipality = atlas.value.municipalities.find(m => m.id === heritageItem.municipalityId)!
const sources = heritageItem.sourceIds.map(id => atlas.value.sources.find(s => s.id === id)!).filter(Boolean)

useSeoMeta({
  title: () => `${heritageItem.name} · Potkalnički zapisi`,
  description: () => heritageItem.researchNotes.slice(0, 160),
  robots: () => heritageItem.noindex ? 'noindex, follow' : 'index, follow'
})

function locationLine() {
  return [settlement.name, heritageItem.locality].filter(Boolean).join(' · ')
}
</script>

<template>
  <div data-testid="heritage-item-page">
    <UPageHero
      :title="heritageItem.name"
      :ui="{ container: 'py-12 sm:py-16' }"
    >
      <template #description>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <PzHeritageStatusBadge :label="t('pz.heritage.statusUnverified')" />
          <UBadge
            variant="subtle"
            :label="categoryLabel(heritageItem.category)"
          />
        </div>
      </template>
    </UPageHero>

    <UPageSection :ui="{ root: 'border-t border-default' }">
      <dl class="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-muted">
            {{ t('pz.heritage.fieldLocation') }}
          </dt>
          <dd class="font-medium text-highlighted">
            {{ locationLine() }}
          </dd>
        </div>
        <div>
          <dt class="text-muted">
            {{ t('pz.heritage.fieldMunicipality') }}
          </dt>
          <dd class="font-medium text-highlighted">
            <ULink
              :to="localePath(`/potkalnicko-prigorje/istrazi/${municipality.slug}`)"
              class="text-primary"
            >
              {{ municipalityName(heritageItem.municipalityId) }}
            </ULink>
          </dd>
        </div>
      </dl>
    </UPageSection>

    <UPageSection
      :title="t('pz.heritage.researchTitle')"
      :ui="{ root: 'border-t border-default' }"
    >
      <p class="text-sm leading-relaxed text-default">
        {{ heritageItem.researchNotes }}
      </p>
    </UPageSection>

    <UPageSection
      :title="t('pz.heritage.sourcesTitle')"
      :ui="{ root: 'border-t border-default' }"
    >
      <ul class="list-disc space-y-2 pl-5 text-sm text-default">
        <li
          v-for="source in sources"
          :key="source.id"
        >
          <ULink
            v-if="source.url"
            :to="source.url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary"
          >
            {{ source.title }}
          </ULink>
          <span v-else>{{ source.title }}</span>
        </li>
      </ul>
    </UPageSection>

    <UPageSection :ui="{ root: 'border-t border-default' }">
      <p class="text-sm text-muted">
        {{ t('pz.heritage.noDescriptionYet') }}
      </p>
      <ULink
        class="mt-4 inline-flex text-sm text-primary"
        :to="localePath(`/potkalnicko-prigorje/naselja/${settlement.slug}`)"
      >
        {{ t('pz.heritage.backToSettlement', { name: settlement.name }) }}
      </ULink>
    </UPageSection>
  </div>
</template>
