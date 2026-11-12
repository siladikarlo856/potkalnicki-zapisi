<script setup lang="ts">
import type { AtlasMunicipalityResponse, AtlasSettlementResponse } from '~~/shared/types/publicAtlas'
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()
const { settlementPath, municipalityPath } = useAtlas()
const { words, areaTrail } = useHeritage()

const settlementSlug = computed(() => String(route.params.naselje))
const { data: page } = await useAtlasFetch<AtlasSettlementResponse>(
  () => `/api/atlas/settlements/${settlementSlug.value}`
)

const correctionOpen = ref(false)
const proposalOpen = ref(false)
const formatDate = (iso: string) => new Intl.DateTimeFormat('hr-HR', { dateStyle: 'long' }).format(new Date(iso))
const settlement = computed(() => page.value?.settlement)
const municipality = computed(() => page.value?.municipality)
const persons = computed(() => page.value?.persons ?? [])
const intangible = computed(() => page.value?.intangible ?? [])

const items = computed(() => (page.value?.items ?? []).map(item => ({
  ...item,
  to: item.path ? localePath(item.path) : undefined,
  categoryLabel: item.category.label
})))

// Thin: no heritage item is linked to the village yet. The page then leads with what is known and one invitation.
const thin = computed(() => items.value.length === 0)

// Neighbours: the other settlements of the same municipality, with their record counts.
const { data: siblings } = useLazyFetch<AtlasMunicipalityResponse>(
  () => `/api/atlas/municipalities/${municipality.value?.slug}`,
  { key: computed(() => `pz-settlement-siblings-${municipality.value?.slug}`), immediate: !!municipality.value }
)
const nearby = computed(() => (siblings.value?.settlements ?? [])
  .filter(other => other.id !== settlement.value?.id)
  .sort((a, b) => b.itemCount - a.itemCount || a.name.localeCompare(b.name, 'hr'))
  .slice(0, 8)
  .map(other => ({
    label: other.itemCount ? `${other.name} · ${t('pz.explore.settlementItemCount', { count: other.itemCount })}` : other.name,
    to: settlementPath(other.slug)
  })))

// Words said in this village (the same area id as the settlement), and, for a thin page, words from the municipality.
const localWords = computed(() => words.value.flatMap((word) => {
  const variant = word.variants.find(candidate => candidate.usages.some(usage => usage.areaId === settlement.value?.id))
  if (!variant) return []
  return [{
    word,
    form: variant.form,
    others: word.variants.filter(other => other.id !== variant.id).map(other => other.form)
  }]
}))
const municipalityWords = computed(() => localWords.value.length
  ? []
  : words.value
      .filter(word => word.variants.some(variant => variant.usages.some(usage => areaTrail(usage.areaId).some(area => area.id === municipality.value?.id))))
      .slice(0, 3))

function wordPath(slug: string | undefined) {
  return localePath(`${pzRoutes.home}/govor/${slug}`)
}

const learnTo = computed(() => localePath({ path: `${pzRoutes.learn}/sesija`, query: { teme: 'rijeci', mjesto: settlementSlug.value } }))
const contributeTypes = usePzContributeTypes(() => ({ settlement: settlementSlug.value }))
const contributeTo = computed(() => localePath(pzRoutes.contribute))

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
  <div
    v-if="settlement && municipality"
    class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-8 px-4 py-6 lg:px-12 lg:py-12"
    :data-state="thin ? 'thin' : 'rich'"
    data-testid="settlement-page"
  >
    <div
      class="grid grid-cols-1 gap-8 lg:gap-x-12"
      :class="thin ? undefined : 'lg:grid-cols-[minmax(0,1fr)_var(--pz-side-panel)]'"
    >
      <header class="flex max-w-(--pz-measure) flex-col gap-3">
        <PzBackPill :to="municipalityPath(municipality.slug)">
          {{ municipality.label }}
        </PzBackPill>
        <p class="pz-overline text-muted">
          {{ t('pz.explore.settlementOverline') }}
        </p>
        <h1 class="pz-h1 wrap-anywhere text-highlighted lg:pz-display">
          {{ settlement.name }}
        </h1>
        <p class="pz-body-sm flex items-center gap-1.5 text-muted">
          <UIcon
            name="i-lucide-map-pin"
            class="size-4 shrink-0"
            aria-hidden="true"
          />
          <NuxtLink
            :to="municipalityPath(municipality.slug)"
            class="text-primary underline underline-offset-2"
          >
            {{ municipality.label }}
          </NuxtLink>
        </p>
        <UButton
          v-if="thin"
          :to="contributeTo"
          :label="t('pz.explore.addRecord')"
          icon="i-lucide-plus"
          size="lg"
          class="mt-1 hidden self-start lg:inline-flex"
          data-testid="settlement-primary-action"
        />
      </header>

      <PzFactPanel
        v-if="!thin"
        class="max-lg:[&_[data-testid=pz-fact-panel-actions]]:hidden lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
        :facts="[
          { label: t('pz.explore.factMunicipality'), value: municipality.label, to: municipalityPath(municipality.slug) },
          { label: t('pz.explore.factRecords'), value: String(items.length) }
        ]"
        :play="{ title: t('pz.explore.playWords', { name: settlement.name }), to: learnTo, description: t('pz.explore.playWordsBlurb') }"
      >
        <template #actions>
          <UButton
            :to="learnTo"
            :label="t('pz.explore.wordsFromHere')"
            icon="i-lucide-book-open"
            size="lg"
            block
            data-testid="settlement-primary-action"
          />
          <UButton
            :label="t('pz.heritage.suggestSettlementCorrection')"
            icon="i-lucide-pencil"
            color="neutral"
            variant="outline"
            size="lg"
            block
            class="ring-(--ui-border-accented)"
            aria-haspopup="dialog"
            data-testid="settlement-suggest-correction"
            @click="correctionOpen = true"
          />
        </template>
      </PzFactPanel>

      <div class="flex min-w-0 flex-col gap-8">
        <PzEmptyState
          v-if="thin"
          :title="t('pz.explore.thinTitle', { name: settlement.name })"
          :municipality="municipality.label"
          :nearby="nearby"
          :contribute-types="contributeTypes"
        >
          <template
            v-if="municipalityWords.length"
            #known
          >
            <ul class="flex flex-col gap-3">
              <li
                v-for="word in municipalityWords"
                :key="word.id"
              >
                <PzWordCard
                  :headword="word.headword"
                  :to="wordPath(word.slug)"
                  :type="word.partOfSpeech"
                  :meaning="word.meaning.hr"
                />
              </li>
            </ul>
          </template>
        </PzEmptyState>

        <section
          v-if="!thin"
          class="flex flex-col gap-4"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.explore.heritageHere') }}
          </h2>
          <ul
            class="grid gap-3"
            data-testid="settlement-heritage-list"
          >
            <li
              v-for="item in items"
              :key="item.id"
            >
              <PzHeritageCard
                :title="item.name"
                :to="item.to ?? localePath(pzRoutes.heritage)"
                :settlement="item.locality ?? undefined"
                :category="item.categoryLabel"
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
        </section>

        <section
          v-if="localWords.length"
          class="flex flex-col gap-4"
          data-testid="settlement-words"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.explore.wordsFromHere') }}
          </h2>
          <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <li
              v-for="entry in localWords"
              :key="entry.word.id"
            >
              <PzWordCard
                :headword="entry.word.headword"
                :to="wordPath(entry.word.slug)"
                :type="entry.word.partOfSpeech"
                :meaning="entry.word.meaning.hr"
                :local-form="entry.form"
                :variant-count="entry.word.variants.length"
                :sample="entry.word.status === 'placeholder'"
              />
            </li>
          </ul>
        </section>

        <section
          v-if="!thin && nearby.length"
          class="flex flex-col gap-2"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.explore.nearbyTitle') }}
          </h2>
          <ul class="flex flex-wrap gap-2">
            <li
              v-for="place in nearby"
              :key="place.to"
            >
              <NuxtLink
                :to="place.to"
                class="pz-caption inline-flex min-h-8 items-center gap-1.5 rounded-full border border-accented bg-default px-2.5 text-default no-underline hover:bg-muted"
              >
                <UIcon
                  name="i-lucide-map-pin"
                  class="size-3.5 shrink-0 text-dimmed"
                  aria-hidden="true"
                />
                {{ place.label }}
              </NuxtLink>
            </li>
          </ul>
        </section>

        <section
          v-if="persons.length"
          class="flex flex-col gap-4"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.persons.fromThisPlace') }}
          </h2>
          <PersonsList
            :persons="persons"
            testid="settlement-persons"
          />
        </section>

        <section
          v-if="intangible.length"
          class="flex flex-col gap-4"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.intangible.fromThisPlace') }}
          </h2>
          <IntangibleRefList
            :records="intangible"
            testid="settlement-intangible"
          />
        </section>

        <div class="flex flex-col gap-2">
          <UButton
            v-if="thin"
            :label="t('pz.heritage.suggestSettlementCorrection')"
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            class="self-start"
            aria-haspopup="dialog"
            data-testid="settlement-suggest-correction"
            @click="correctionOpen = true"
          />
          <UButton
            v-else
            :label="t('pz.heritage.suggestItemIn', { name: settlement.name })"
            icon="i-lucide-plus"
            color="neutral"
            variant="ghost"
            class="self-start"
            aria-haspopup="dialog"
            data-testid="settlement-suggest-item"
            @click="proposalOpen = true"
          />
          <p
            v-if="settlement.credits.length"
            class="pz-body-sm text-muted"
            data-testid="settlement-credits"
          >
            {{ t('pz.heritage.credits', { names: settlement.credits.map(credit => credit.name).join(', ') }) }}
          </p>
          <p
            class="pz-caption text-dimmed"
            data-testid="settlement-updated"
          >
            {{ t('pz.heritage.updatedAt', { date: formatDate(settlement.updatedAt) }) }}
          </p>
        </div>
      </div>
    </div>

    <PzStickyActionBar>
      <template v-if="!thin">
        <UButton
          :label="t('pz.explore.correctShort')"
          color="neutral"
          variant="outline"
          size="lg"
          class="ring-(--ui-border-accented)"
          aria-haspopup="dialog"
          data-testid="settlement-suggest-correction-mobile"
          @click="correctionOpen = true"
        />
        <UButton
          :to="learnTo"
          :label="t('pz.explore.wordsFromHere')"
          icon="i-lucide-book-open"
          size="lg"
          data-testid="settlement-primary-action-mobile"
        />
      </template>
      <UButton
        v-else
        :to="contributeTo"
        :label="t('pz.explore.addRecord')"
        icon="i-lucide-plus"
        size="lg"
        data-testid="settlement-primary-action-mobile"
      />
    </PzStickyActionBar>

    <HeritageSuggestDialog
      v-model:open="correctionOpen"
      kind="area"
      mode="correction"
      :target="{ id: settlement.id, label: settlement.name }"
      :current="{ name: settlement.name }"
    />
    <HeritageSuggestDialog
      v-model:open="proposalOpen"
      kind="heritage_item"
      mode="proposal"
      :prefill="{ settlementId: settlement.id }"
    />
  </div>
</template>
