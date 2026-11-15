<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { AtlasHeritageListResponse, AtlasMunicipalityResponse } from '~~/shared/types/publicAtlas'
import { pzRoutes } from '~~/shared/utils/appRoutes'

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
const persons = computed(() => page.value?.persons ?? [])
const intangible = computed(() => page.value?.intangible ?? [])

const settlements = computed(() => (page.value?.settlements ?? []).map(s => ({
  ...s,
  to: settlementPath(s.slug)
})).sort((a, b) => a.name.localeCompare(b.name, 'hr')))

// "Baština" tab: the municipality's items, from the same list API the heritage list uses.
const { data: heritage } = useLazyFetch<AtlasHeritageListResponse>('/api/atlas/heritage', {
  query: computed(() => ({ municipality: municipalitySlug.value })),
  key: computed(() => `pz-municipality-heritage-${municipalitySlug.value}`)
})
const heritageItems = computed(() => heritage.value?.items ?? [])

const tabs = computed<TabsItem[]>(() => [
  { label: t('pz.explore.tabSettlements'), value: 'naselja', slot: 'naselja' as const },
  { label: t('pz.explore.tabHeritage'), value: 'bastina', slot: 'bastina' as const }
])
const tab = ref('naselja')

const contributeTypes = usePzContributeTypes(() => ({ municipality: municipalitySlug.value }))

useSeoMeta({
  title: () => municipality.value ? `${municipality.value.label} · Potkalnički zapisi` : '',
  description: () => stats.value
    ? t('pz.explore.municipalityDescription', { settlements: stats.value.settlements, items: stats.value.items })
    : ''
})
</script>

<template>
  <div
    v-if="municipality && stats"
    class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-8 px-4 py-6 lg:px-12 lg:py-12"
    data-testid="municipality-page"
  >
    <header class="flex max-w-(--pz-measure) flex-col gap-3">
      <PzBackPill :to="localePath(pzRoutes.explore)">
        {{ t('pz.explore.allRegions') }}
      </PzBackPill>
      <p class="pz-overline text-muted">
        {{ t('pz.explore.municipalityOverline') }}
      </p>
      <h1 class="pz-h1 wrap-anywhere text-highlighted lg:pz-display">
        {{ municipality.label }}
      </h1>
      <p class="pz-body text-muted">
        {{ t('pz.explore.municipalityDescription', { settlements: stats.settlements, items: stats.items }) }}
      </p>
      <dl
        class="flex gap-8"
        data-testid="municipality-stats"
      >
        <div>
          <dt class="pz-caption text-muted">
            {{ t('pz.explore.statSettlements') }}
          </dt>
          <dd class="pz-numeral m-0 text-highlighted">
            {{ stats.settlements }}
          </dd>
        </div>
        <div>
          <dt class="pz-caption text-muted">
            {{ t('pz.explore.statItems') }}
          </dt>
          <dd class="pz-numeral m-0 text-highlighted">
            {{ stats.items }}
          </dd>
        </div>
      </dl>
    </header>

    <UTabs
      v-model="tab"
      :items="tabs"
      value-key="value"
      variant="pill"
      class="w-full"
    >
      <template #naselja>
        <ul
          class="mt-4 divide-y divide-default overflow-hidden rounded-(--pz-radius-lg) border border-default bg-default lg:max-w-(--pz-measure)"
          data-testid="settlement-list"
        >
          <li
            v-for="settlement in settlements"
            :key="settlement.id"
          >
            <NuxtLink
              :to="settlement.to"
              class="flex min-h-(--pz-tap-min) items-center justify-between gap-3 px-4 py-3 no-underline hover:bg-muted"
            >
              <span class="font-serif text-[17px]/[22px] font-semibold wrap-anywhere text-highlighted">{{ settlement.name }}</span>
              <span
                class="pz-caption shrink-0 font-normal tabular-nums"
                :class="settlement.itemCount ? 'text-muted' : 'text-dimmed'"
              >
                {{ settlement.itemCount ? t('pz.explore.settlementItemCount', { count: settlement.itemCount }) : t('pz.explore.settlementNoRecords') }}
              </span>
            </NuxtLink>
          </li>
        </ul>
      </template>

      <template #bastina>
        <div class="mt-4 flex flex-col gap-4">
          <h2 class="sr-only">
            {{ t('pz.explore.tabHeritage') }}
          </h2>
          <ul
            v-if="heritageItems.length"
            class="grid gap-3 lg:grid-cols-2"
            data-testid="municipality-heritage-list"
          >
            <li
              v-for="item in heritageItems"
              :key="item.id"
              class="flex"
            >
              <PzHeritageCard
                class="w-full"
                :title="item.name"
                :to="item.path ? localePath(item.path) : localePath(pzRoutes.heritage)"
                :settlement="item.settlement?.name"
                :category="item.category.label"
                :icon="pzHeritageIcon(item.category.key)"
                :image="item.thumb?.url"
                :image-credit="item.thumb ? t('pz.photos.credit', { author: item.thumb.author, license: item.thumb.licenseLabel }) : undefined"
              >
                <template #trust>
                  <PzVerificationBadge :verification="item.verification" />
                </template>
              </PzHeritageCard>
            </li>
          </ul>
          <PzEmptyState
            v-else-if="heritage"
            :title="t('pz.explore.emptyHeritageTitle', { name: municipality.label })"
            :contribute-types="contributeTypes"
          />
        </div>
      </template>
    </UTabs>

    <PzGameCard
      :title="t('pz.explore.playSettlements')"
      :blurb="t('pz.explore.playSettlementsBlurb')"
      :to="localePath(pzRoutes.selaOpcine)"
      icon="i-lucide-map-pin"
      :level="2"
      class="lg:max-w-(--pz-measure)"
    />

    <section
      v-if="persons.length"
      class="flex flex-col gap-4"
    >
      <h2 class="pz-h2 text-highlighted">
        {{ t('pz.persons.fromThisPlace') }}
      </h2>
      <PersonsList
        :persons="persons"
        testid="municipality-persons"
      />
    </section>

    <section
      v-if="intangible.length"
      class="flex flex-col gap-4 lg:max-w-(--pz-measure)"
    >
      <h2 class="pz-h2 text-highlighted">
        {{ t('pz.intangible.fromThisPlace') }}
      </h2>
      <IntangibleRefList
        :records="intangible"
        testid="municipality-intangible"
      />
    </section>

    <div class="flex flex-col gap-3">
      <UButton
        :label="t('pz.heritage.missingItem')"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        class="min-h-(--pz-tap-min) max-w-full justify-start self-start text-start whitespace-normal ring-(--ui-border-accented)"
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
    </div>
  </div>
</template>
