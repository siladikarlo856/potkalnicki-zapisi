<script setup lang="ts">
import type { AtlasHeritageListResponse } from '~~/shared/types/publicAtlas'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()

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

useSeoMeta({
  title: () => t('pz.heritage.listTitle'),
  ogTitle: () => `${t('pz.heritage.listTitle')} · Potkalnički zapisi`,
  description: () => t('pz.heritage.listIntro'),
  ogDescription: () => t('pz.heritage.listIntro')
})
</script>

<template>
  <div>
    <UPageHero
      :title="t('pz.heritage.listTitle')"
      :description="t('pz.heritage.listIntro')"
      :ui="{ container: 'py-12 sm:py-16' }"
    />

    <UPageSection :ui="{ root: 'border-t border-default' }">
      <div class="mb-6 flex flex-wrap gap-4">
        <UFormField :label="t('pz.heritage.filterMunicipality')">
          <USelect
            v-model="municipalityFilter"
            :items="municipalityOptions"
            class="min-w-48"
            data-testid="heritage-filter-municipality"
          />
        </UFormField>
        <UFormField :label="t('pz.heritage.filterCategory')">
          <USelect
            v-model="categoryFilter"
            :items="categoryOptions"
            class="min-w-48"
            data-testid="heritage-filter-category"
          />
        </UFormField>
      </div>

      <ul
        class="divide-y divide-default rounded-lg ring ring-default"
        data-testid="heritage-list"
      >
        <li
          v-for="item in filtered"
          :key="item.id"
        >
          <ULink
            v-if="item.path"
            :to="localePath(item.path)"
            class="block px-4 py-3 hover:bg-elevated/40"
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="space-y-1">
                <p class="font-medium text-highlighted">
                  {{ item.name }}
                </p>
                <p class="text-sm text-muted">
                  {{ item.category.label }} · {{ locationLabel(item) }} · {{ item.municipality.label }}
                </p>
              </div>
              <PzHeritageStatusBadge :verification="item.verification" />
            </div>
          </ULink>
          <div
            v-else
            class="block px-4 py-3"
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="space-y-1">
                <p class="font-medium text-highlighted">
                  {{ item.name }}
                </p>
                <p class="text-sm text-muted">
                  {{ item.category.label }} · {{ locationLabel(item) }} · {{ item.municipality.label }}
                </p>
              </div>
              <PzHeritageStatusBadge :verification="item.verification" />
            </div>
          </div>
        </li>
      </ul>

      <div class="mt-6">
        <UButton
          :label="t('pz.heritage.missingItem')"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
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
    </UPageSection>
  </div>
</template>
