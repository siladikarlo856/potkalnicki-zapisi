<script setup lang="ts">
import type { AtlasHeritageItemResponse } from '~~/shared/types/publicAtlas'
import { pzRoutes } from '~~/shared/utils/appRoutes'
import { trustVerificationState } from '~~/shared/utils/heritageVerification'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()
const { settlementPath, municipalityPath } = useAtlas()

const settlementSlug = computed(() => String(route.params.naselje))
const itemSlug = computed(() => String(route.params.slug))
const { data: payload } = await useAtlasFetch<AtlasHeritageItemResponse>(
  () => `/api/atlas/heritage/${settlementSlug.value}/${itemSlug.value}`
)

const heritageItem = computed(() => payload.value?.item)

const correctionOpen = ref(false)
const sourceOpen = ref(false)
const correctionCurrent = computed<Record<string, string | undefined>>(() => heritageItem.value
  ? {
      name: heritageItem.value.name,
      categoryKey: heritageItem.value.category.key,
      settlementId: heritageItem.value.settlement?.id ?? '',
      locality: heritageItem.value.locality ?? '',
      period: heritageItem.value.period ?? '',
      description: heritageItem.value.description ?? ''
    }
  : {})
const formatDate = (iso: string) => new Intl.DateTimeFormat('hr-HR', { dateStyle: 'long' }).format(new Date(iso))

// The description is what the record says; the research notes (what is still being checked) only stand in
// while there is no description.
const metaDescription = computed(() => (heritageItem.value?.description || heritageItem.value?.researchNotes || '').slice(0, 160))
const mainPhoto = computed(() => heritageItem.value?.images[0])

useSeoMeta({
  title: () => heritageItem.value ? `${heritageItem.value.name} · Potkalnički zapisi` : '',
  ogTitle: () => heritageItem.value ? `${heritageItem.value.name} · Potkalnički zapisi` : '',
  description: () => metaDescription.value,
  ogDescription: () => metaDescription.value,
  // Without a photo the layout's share image (and its size) stays.
  ogImage: () => mainPhoto.value?.url,
  ogImageWidth: () => mainPhoto.value?.width,
  ogImageHeight: () => mainPhoto.value?.height,
  ogImageAlt: () => mainPhoto.value?.alt,
  robots: () => heritageItem.value?.noindex ? 'noindex, follow' : 'index, follow'
})

function locationLine() {
  if (!heritageItem.value) return ''
  return [heritageItem.value.settlement?.name, heritageItem.value.locality].filter(Boolean).join(' · ')
}

// Protection comes only from the record's own registry status; a missing or other status shows no tag.
const protectedItem = computed(() => heritageItem.value?.heritageStatus === 'protected')

const facts = computed(() => heritageItem.value
  ? [
      {
        label: t('pz.heritage.fieldLocation'),
        value: locationLine() || null,
        to: heritageItem.value.settlement ? settlementPath(heritageItem.value.municipality.slug, heritageItem.value.settlement.slug) : undefined
      },
      { label: t('pz.heritage.fieldMunicipality'), value: heritageItem.value.municipality.label, to: municipalityPath(heritageItem.value.municipality.slug) },
      { label: t('pz.heritage.fieldPeriod'), value: heritageItem.value.period }
    ]
  : [])

const sources = computed(() => (heritageItem.value?.sources ?? []).map(source => ({
  label: source.title,
  href: source.url ?? undefined
})))

const playTo = computed(() => ['church', 'cathedral', 'chapel', 'chapel-shrine', 'monastery'].includes(heritageItem.value?.category.key ?? '')
  ? localePath(pzRoutes.churchWhere)
  : undefined)

const verificationHelp = computed(() => ({
  verified: t('pz.trust.help.verified'),
  needs_update: t('pz.trust.help.needsUpdate'),
  unverified: t('pz.trust.help.unverified')
}[trustVerificationState(heritageItem.value?.verification)]))
</script>

<template>
  <div
    v-if="heritageItem"
    class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-8 px-4 py-6 lg:px-12 lg:py-12"
    data-testid="heritage-item-page"
  >
    <div class="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_var(--pz-side-panel)] lg:gap-x-12">
      <header class="flex max-w-(--pz-measure) flex-col gap-3">
        <PzBackPill
          v-if="heritageItem.settlement"
          :to="settlementPath(heritageItem.municipality.slug, heritageItem.settlement.slug)"
        >
          {{ heritageItem.settlement.name }}
        </PzBackPill>
        <p class="pz-overline text-muted">
          {{ heritageItem.category.label }}
        </p>
        <h1 class="pz-h1 wrap-anywhere text-highlighted lg:pz-display">
          {{ heritageItem.name }}
        </h1>
        <div
          class="flex flex-wrap items-center gap-2 lg:hidden"
          data-testid="heritage-trust-row"
        >
          <PzVerificationBadge :verification="heritageItem.verification" />
          <PzProtectionTag
            v-if="protectedItem"
            status="protected"
            :register="heritageItem.registryNumber ?? undefined"
          />
          <UBadge
            :label="heritageItem.category.label"
            color="neutral"
            variant="subtle"
            class="rounded-(--pz-radius-sm)"
          />
        </div>
      </header>

      <PzFactPanel
        class="max-lg:[&_[data-testid=pz-fact-panel-actions]]:hidden max-lg:[&_[data-testid=pz-fact-panel-trust]]:hidden lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
        :facts="facts"
        :sources="sources"
        :play="playTo ? { to: playTo, description: t('pz.heritage.playBlurb') } : undefined"
      >
        <template #trust>
          <div class="flex flex-col gap-1">
            <div>
              <PzVerificationBadge :verification="heritageItem.verification" />
            </div>
            <p class="pz-caption font-normal text-muted">
              {{ verificationHelp }}
            </p>
          </div>
          <div
            v-if="protectedItem"
            class="flex flex-col gap-1"
          >
            <div>
              <PzProtectionTag
                status="protected"
                :register="heritageItem.registryNumber ?? undefined"
              />
            </div>
            <p class="pz-caption font-normal text-muted">
              {{ t('pz.trust.help.protection') }}
            </p>
          </div>
        </template>
        <template #actions>
          <UButton
            :label="t('pz.heritage.suggestCorrection')"
            icon="i-lucide-pencil"
            size="lg"
            block
            aria-haspopup="dialog"
            data-testid="heritage-suggest-correction"
            @click="correctionOpen = true"
          />
          <UButton
            :label="t('pz.heritage.addSource')"
            icon="i-lucide-book-plus"
            color="neutral"
            variant="outline"
            size="lg"
            block
            class="ring-(--ui-border-accented)"
            aria-haspopup="dialog"
            data-testid="heritage-suggest-source"
            @click="sourceOpen = true"
          />
        </template>
      </PzFactPanel>

      <div class="flex min-w-0 max-w-(--pz-measure) flex-col gap-8">
        <PzHeritagePhotos
          v-if="heritageItem.images.length"
          :images="heritageItem.images"
        />

        <UAlert
          v-if="heritageItem.researchNotes"
          color="warning"
          variant="subtle"
          icon="i-lucide-search"
          :title="t('pz.heritage.researchTitle')"
          :description="heritageItem.researchNotes"
          data-testid="heritage-research-note"
        />

        <section class="flex flex-col gap-2">
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.heritage.descriptionTitle') }}
          </h2>
          <p
            v-if="heritageItem.description"
            class="pz-body text-default"
            lang="hr"
          >
            {{ heritageItem.description }}
          </p>
          <p
            v-else
            class="pz-body text-muted"
          >
            {{ t('pz.heritage.noDescriptionYet') }}
            <button
              type="button"
              class="text-primary underline underline-offset-2"
              aria-haspopup="dialog"
              @click="correctionOpen = true"
            >
              {{ t('pz.heritage.knowSomething') }}
            </button>
          </p>
        </section>

        <section
          v-if="heritageItem.persons.length"
          class="flex flex-col gap-4"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.persons.related') }}
          </h2>
          <PersonsList
            :persons="heritageItem.persons"
            testid="heritage-persons"
          />
        </section>

        <PzSourceList
          :sources="heritageItem.sources.map(source => source.title)"
          :add-to="localePath({ path: pzRoutes.contribute, query: { vrsta: 'izvor', zapis: heritageItem.ref } })"
          data-testid="heritage-sources"
        />

        <div class="flex flex-col gap-1">
          <p
            v-if="heritageItem.credits.length"
            class="pz-body-sm text-muted"
            data-testid="heritage-credits"
          >
            {{ t('pz.heritage.credits', { names: heritageItem.credits.map(credit => credit.name).join(', ') }) }}
          </p>
          <p
            class="pz-caption text-dimmed"
            data-testid="heritage-updated"
          >
            {{ t('pz.heritage.updatedAt', { date: formatDate(heritageItem.updatedAt) }) }}
          </p>
        </div>
      </div>
    </div>

    <PzStickyActionBar>
      <UButton
        :label="t('pz.heritage.addSource')"
        color="neutral"
        variant="outline"
        size="lg"
        class="ring-(--ui-border-accented)"
        aria-haspopup="dialog"
        data-testid="heritage-suggest-source-mobile"
        @click="sourceOpen = true"
      />
      <UButton
        :label="t('pz.heritage.suggestCorrection')"
        size="lg"
        aria-haspopup="dialog"
        data-testid="heritage-suggest-correction-mobile"
        @click="correctionOpen = true"
      />
    </PzStickyActionBar>

    <HeritageSuggestDialog
      v-model:open="correctionOpen"
      kind="heritage_item"
      mode="correction"
      :target="{ id: heritageItem.ref, label: heritageItem.name }"
      :current="correctionCurrent"
    />
    <HeritageSuggestDialog
      v-model:open="sourceOpen"
      kind="source"
      mode="proposal"
      :prefill="{ note: t('pz.heritage.sourceFor', { name: heritageItem.name }) }"
    />
  </div>
</template>
