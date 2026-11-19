<script setup lang="ts">
import type { AtlasIntangibleListResponse } from '~~/shared/types/publicIntangible'
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const localePath = useLocalePath()
const count = usePzCount()

// The filters live in the address (?kind=obicaji&type=godisnji&theme=vino&place=opcina-kalnik), so a filtered list
// can be shared. `type` only makes sense with a kind: types are per kind.
const FILTER_KEYS = ['kind', 'type', 'theme', 'place'] as const
type FilterKey = typeof FILTER_KEYS[number]

const filters = computed(() => {
  const active: Partial<Record<FilterKey, string>> = {}
  for (const key of FILTER_KEYS) {
    const value = route.query[key]
    if (typeof value === 'string' && value) active[key] = value
  }
  return active
})
const hasFilters = computed(() => Object.keys(filters.value).length > 0)

const { data: page } = await useAtlasFetch<AtlasIntangibleListResponse>(
  () => `/api/atlas/intangible${hasFilters.value ? `?${new URLSearchParams(filters.value as Record<string, string>)}` : ''}`
)

function setFilter(key: FilterKey, value: string) {
  const next = Object.fromEntries(Object.entries({ ...filters.value, [key]: value })
    .filter(([name, entry]) => entry && !(key === 'kind' && name === 'type')))
  router.replace({ query: next })
}

const ALL = 'all'
const themeOptions = computed(() => [{ label: t('pz.intangible.filterAll'), value: ALL }, ...(page.value?.themes ?? []).map(o => ({ label: o.label, value: o.slug }))])
const placeOptions = computed(() => [{ label: t('pz.intangible.filterAll'), value: ALL }, ...(page.value?.places ?? []).map(o => ({ label: o.label, value: o.slug }))])
const kindOptions = computed(() => [{ label: t('pz.intangible.filterAll'), value: '' }, ...(page.value?.kinds ?? []).map(o => ({ label: o.label, value: o.slug }))])
const typeOptions = computed(() => [{ label: t('pz.intangible.filterAll'), value: '' }, ...(page.value?.types ?? []).map(o => ({ label: o.label, value: o.key }))])

const theme = computed({ get: () => filters.value.theme ?? ALL, set: value => setFilter('theme', value === ALL ? '' : value) })
const place = computed({ get: () => filters.value.place ?? ALL, set: value => setFilter('place', value === ALL ? '' : value) })

const memoryTo = computed(() => localePath({ path: pzRoutes.contribute, query: { vrsta: 'sjecanje' } }))

useSeoMeta({
  title: () => t('pz.intangible.seoTitle'),
  ogTitle: () => `${t('pz.intangible.seoTitle')} · Potkalnički zapisi`,
  description: () => t('pz.intangible.intro'),
  ogDescription: () => t('pz.intangible.intro')
})
</script>

<template>
  <div
    v-if="page"
    class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-6 px-4 py-6 lg:px-12 lg:py-12"
    data-testid="intangible-page"
  >
    <header class="flex max-w-(--pz-measure) flex-col gap-3">
      <h1 class="pz-h1 text-highlighted lg:pz-display">
        {{ t('pz.intangible.title') }}
      </h1>
      <p class="pz-body text-muted">
        {{ t('pz.intangible.intro') }}
      </p>
    </header>

    <PzEmptyState
      v-if="!page.total && !hasFilters"
      :title="t('pz.intangible.emptyTitle')"
      :description="t('pz.intangible.emptyAsk')"
      :contribute-types="[{ label: t('pz.intangible.contributeMemory'), to: memoryTo, icon: 'i-lucide-message-circle' }]"
      data-testid="intangible-empty"
    />

    <div
      v-else
      class="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8"
    >
      <div
        class="sticky top-0 z-10 -mx-4 flex flex-col gap-3 border-b border-default bg-default px-4 py-3 lg:top-22 lg:col-span-3 lg:mx-0 lg:gap-5 lg:rounded-(--pz-radius-lg) lg:border lg:bg-muted lg:p-4"
        role="group"
        :aria-label="t('pz.intangible.filtersLabel')"
        data-testid="intangible-filters"
      >
        <div
          class="flex flex-col gap-1.5"
          role="group"
          :aria-label="t('pz.intangible.filterKind')"
        >
          <span class="pz-label hidden text-default lg:block">{{ t('pz.intangible.filterKind') }}</span>
          <ul
            class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
            data-testid="intangible-filter-kind"
          >
            <li
              v-for="option in kindOptions"
              :key="option.value"
              class="shrink-0"
            >
              <button
                type="button"
                class="pz-label inline-flex min-h-(--pz-tap-min) items-center rounded-full border px-3.5 whitespace-nowrap"
                :class="(filters.kind ?? '') === option.value
                  ? 'border-primary bg-accented text-highlighted'
                  : 'border-accented bg-default text-default hover:bg-muted'"
                :aria-pressed="(filters.kind ?? '') === option.value"
                :data-kind="option.value || 'all'"
                @click="setFilter('kind', option.value)"
              >
                {{ option.label }}
              </button>
            </li>
          </ul>
        </div>

        <div
          v-if="page.types.length"
          class="flex flex-col gap-1.5"
          role="group"
          :aria-label="t('pz.intangible.filterType')"
        >
          <span class="pz-label hidden text-default lg:block">{{ t('pz.intangible.filterType') }}</span>
          <ul
            class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
            data-testid="intangible-filter-type"
          >
            <li
              v-for="option in typeOptions"
              :key="option.value"
              class="shrink-0"
            >
              <button
                type="button"
                class="pz-label inline-flex min-h-(--pz-tap-min) items-center rounded-full border px-3.5 whitespace-nowrap"
                :class="(filters.type ?? '') === option.value
                  ? 'border-primary bg-accented text-highlighted'
                  : 'border-accented bg-default text-default hover:bg-muted'"
                :aria-pressed="(filters.type ?? '') === option.value"
                :data-type="option.value || 'all'"
                @click="setFilter('type', option.value)"
              >
                {{ option.label }}
              </button>
            </li>
          </ul>
        </div>

        <div class="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <UFormField
            v-if="page.themes.length"
            :label="t('pz.intangible.filterTheme')"
          >
            <USelect
              v-model="theme"
              :items="themeOptions"
              class="w-full lg:min-w-0"
              data-testid="intangible-filter-theme"
            />
          </UFormField>
          <UFormField
            v-if="page.places.length"
            :label="t('pz.intangible.filterPlace')"
          >
            <USelect
              v-model="place"
              :items="placeOptions"
              class="w-full lg:min-w-0"
              data-testid="intangible-filter-place"
            />
          </UFormField>
        </div>
      </div>

      <div class="flex min-w-0 flex-col gap-4 lg:col-span-9">
        <h2 class="sr-only">
          {{ t('pz.intangible.listHeading') }}
        </h2>
        <p
          class="pz-body-sm text-muted"
          role="status"
          data-testid="intangible-count"
        >
          {{ count('pz.intangible.resultCount', page.total) }}
        </p>

        <IntangibleRecordList
          v-if="page.records.length"
          :records="page.records"
          :aria-label="t('pz.intangible.listLabel')"
          testid="intangible-list"
        />
        <template v-else>
          <PzEmptyState
            :title="t('pz.intangible.noResultsTitle')"
            :description="t('pz.intangible.noResultsAsk')"
          />
          <UButton
            :label="t('pz.intangible.clearFilters')"
            color="neutral"
            variant="outline"
            class="self-start ring-(--ui-border-accented)"
            data-testid="intangible-clear-filters"
            @click="router.replace({ query: {} })"
          />
        </template>

        <UButton
          :label="t('pz.intangible.contributeMemory')"
          :to="memoryTo"
          icon="i-lucide-message-circle"
          color="neutral"
          variant="outline"
          class="mt-2 min-h-(--pz-tap-min) max-w-full justify-start self-start text-start whitespace-normal ring-(--ui-border-accented)"
          data-testid="intangible-contribute"
        />
      </div>
    </div>
  </div>
</template>
