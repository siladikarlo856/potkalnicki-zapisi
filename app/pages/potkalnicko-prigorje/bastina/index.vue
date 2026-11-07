<script setup lang="ts">
import type { AtlasHeritageListResponse } from '~~/shared/types/publicAtlas'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const count = usePzCount()

const proposalOpen = ref(false)
const municipalityFilter = ref('all')
const categoryFilter = ref('all')

const listQuery = computed(() => {
  const query: Record<string, string> = {}
  if (municipalityFilter.value !== 'all') query.municipality = municipalityFilter.value
  if (categoryFilter.value !== 'all') query.category = categoryFilter.value
  return query
})

const { data: list, error: listError } = await useFetch<AtlasHeritageListResponse>('/api/atlas/heritage', { query: listQuery })
watchEffect(() => {
  if (listError.value) {
    throw createError({
      statusCode: listError.value.statusCode ?? 500,
      statusMessage: listError.value.statusMessage ?? 'Request failed',
      fatal: true
    })
  }
})

const filtered = computed(() => list.value?.items ?? [])

const municipalityOptions = computed(() => [
  { label: t('pz.heritage.filterAll'), value: 'all' },
  ...(list.value?.municipalities ?? []).map(m => ({ label: m.label, value: m.slug }))
])

const categoryOptions = computed(() => [
  { label: t('pz.heritage.filterAll'), value: 'all' },
  ...(list.value?.categories ?? []).map(c => ({ label: c.label, value: c.key }))
])

function locationLabel(item: (typeof filtered.value)[number]) {
  const parts = [item.settlement?.name, item.locality].filter(Boolean)
  return parts.length ? parts.join(' · ') : t('pz.heritage.locationPending')
}

function clearFilters() {
  municipalityFilter.value = 'all'
  categoryFilter.value = 'all'
}

useSeoMeta({
  title: () => t('pz.heritage.listTitle'),
  ogTitle: () => `${t('pz.heritage.listTitle')} · Potkalnički zapisi`,
  description: () => t('pz.heritage.listIntro'),
  ogDescription: () => t('pz.heritage.listIntro')
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-6 px-4 py-6 lg:px-12 lg:py-12">
    <header class="flex max-w-(--pz-measure) flex-col gap-3">
      <h1 class="pz-h1 text-highlighted lg:pz-display">
        {{ t('pz.heritage.listTitle') }}
      </h1>
      <p class="pz-body text-muted">
        {{ t('pz.heritage.listIntro') }}
      </p>
    </header>

    <div class="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
      <div
        class="sticky top-(--pz-header-h) z-10 -mx-4 flex flex-col gap-3 border-b border-default bg-default px-4 py-3 lg:top-22 lg:col-span-3 lg:mx-0 lg:gap-5 lg:rounded-(--pz-radius-lg) lg:border lg:bg-muted lg:p-4"
        role="group"
        :aria-label="t('pz.heritage.filtersLabel')"
        data-testid="heritage-filters"
      >
        <UFormField :label="t('pz.heritage.filterMunicipality')">
          <USelect
            v-model="municipalityFilter"
            :items="municipalityOptions"
            class="w-full lg:min-w-0"
            data-testid="heritage-filter-municipality"
          />
        </UFormField>
        <div
          class="flex flex-col gap-1.5"
          role="group"
          :aria-label="t('pz.heritage.filterCategory')"
        >
          <span class="pz-label hidden text-default lg:block">{{ t('pz.heritage.filterCategory') }}</span>
          <ul
            class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
            data-testid="heritage-filter-category"
          >
            <li
              v-for="option in categoryOptions"
              :key="option.value"
              class="shrink-0"
            >
              <button
                type="button"
                class="pz-label inline-flex min-h-(--pz-tap-min) items-center rounded-full border px-3.5 whitespace-nowrap"
                :class="categoryFilter === option.value
                  ? 'border-primary bg-accented text-highlighted'
                  : 'border-accented bg-default text-default hover:bg-muted'"
                :aria-pressed="categoryFilter === option.value"
                :data-category="option.value"
                @click="categoryFilter = option.value"
              >
                {{ option.label }}
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div class="flex min-w-0 flex-col gap-4 lg:col-span-9">
        <p
          class="pz-body-sm text-muted"
          role="status"
          data-testid="heritage-count"
        >
          {{ count('pz.heritage.resultCount', filtered.length) }}
        </p>

        <ul
          v-if="filtered.length"
          class="grid gap-3 lg:grid-cols-2"
          data-testid="heritage-list"
        >
          <li
            v-for="item in filtered"
            :key="item.id"
            class="flex"
          >
            <PzHeritageCard
              class="w-full"
              :title="item.name"
              :to="item.path ? localePath(item.path) : localePath(`/potkalnicko-prigorje/istrazi/${item.municipality.slug}`)"
              :settlement="locationLabel(item)"
              :municipality="item.municipality.label"
              :category="item.category.label"
              :icon="pzHeritageIcon(item.category.key)"
            >
              <template #trust>
                <PzVerificationBadge :verification="item.verification" />
              </template>
            </PzHeritageCard>
          </li>
        </ul>
        <template v-else>
          <PzEmptyState
            :title="t('pz.heritage.noResultsTitle')"
            :description="t('pz.heritage.noResultsAsk')"
          />
          <UButton
            :label="t('pz.heritage.clearFilters')"
            color="neutral"
            variant="outline"
            class="self-start ring-(--ui-border-accented)"
            data-testid="heritage-clear-filters"
            @click="clearFilters"
          />
        </template>

        <div class="mt-2">
          <UButton
            :label="t('pz.heritage.missingItem')"
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            class="ring-(--ui-border-accented)"
            aria-haspopup="dialog"
            data-testid="heritage-list-suggest-item"
            @click="proposalOpen = true"
          />
          <HeritageSuggestDialog
            v-model:open="proposalOpen"
            kind="heritage_item"
            mode="proposal"
          />
        </div>
      </div>
    </div>
  </div>
</template>
