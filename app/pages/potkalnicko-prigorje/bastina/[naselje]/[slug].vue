<script setup lang="ts">
import type { AtlasHeritageItemResponse } from '~~/shared/types/publicAtlas'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

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

useSeoMeta({
  title: () => heritageItem.value ? `${heritageItem.value.name} · Potkalnički zapisi` : '',
  ogTitle: () => heritageItem.value ? `${heritageItem.value.name} · Potkalnički zapisi` : '',
  description: () => heritageItem.value?.researchNotes.slice(0, 160) ?? '',
  ogDescription: () => heritageItem.value?.researchNotes.slice(0, 160) ?? '',
  robots: () => heritageItem.value?.noindex ? 'noindex, follow' : 'index, follow'
})

function locationLine() {
  if (!heritageItem.value) return ''
  return [heritageItem.value.settlement?.name, heritageItem.value.locality].filter(Boolean).join(' · ')
}
</script>

<template>
  <div
    v-if="heritageItem"
    data-testid="heritage-item-page"
  >
    <UPageHero
      :title="heritageItem.name"
      :ui="{ container: 'py-12 sm:py-16' }"
    >
      <template #description>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <PzHeritageStatusBadge :verification="heritageItem.verification" />
          <UBadge
            variant="subtle"
            :label="heritageItem.category.label"
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
              :to="localePath(`/potkalnicko-prigorje/istrazi/${heritageItem.municipality.slug}`)"
              class="text-primary"
            >
              {{ heritageItem.municipality.label }}
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
          v-for="source in heritageItem.sources"
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

    <UPageSection
      v-if="heritageItem.persons.length"
      :title="t('pz.persons.related')"
      :ui="{ root: 'border-t border-default' }"
    >
      <PersonsList
        :persons="heritageItem.persons"
        testid="heritage-persons"
      />
    </UPageSection>

    <UPageSection :ui="{ root: 'border-t border-default' }">
      <p class="text-sm text-muted">
        {{ t('pz.heritage.noDescriptionYet') }}
      </p>
      <div class="mt-4 flex flex-wrap gap-3">
        <UButton
          :label="t('pz.heritage.suggestCorrection')"
          icon="i-lucide-pencil"
          color="neutral"
          variant="outline"
          aria-haspopup="dialog"
          data-testid="heritage-suggest-correction"
          @click="correctionOpen = true"
        />
        <UButton
          :label="t('pz.heritage.addSource')"
          icon="i-lucide-book-plus"
          color="neutral"
          variant="outline"
          aria-haspopup="dialog"
          data-testid="heritage-suggest-source"
          @click="sourceOpen = true"
        />
      </div>
      <p
        v-if="heritageItem.credits.length"
        class="mt-4 text-sm text-muted"
        data-testid="heritage-credits"
      >
        {{ t('pz.heritage.credits', { names: heritageItem.credits.map(credit => credit.name).join(', ') }) }}
      </p>
      <p
        class="mt-2 text-xs text-muted"
        data-testid="heritage-updated"
      >
        {{ t('pz.heritage.updatedAt', { date: formatDate(heritageItem.updatedAt) }) }}
      </p>
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
      <ULink
        v-if="heritageItem.settlement"
        class="mt-4 inline-flex text-sm text-primary"
        :to="localePath(`/potkalnicko-prigorje/naselja/${heritageItem.settlement.slug}`)"
      >
        {{ t('pz.heritage.backToSettlement', { name: heritageItem.settlement.name }) }}
      </ULink>
    </UPageSection>
  </div>
</template>
