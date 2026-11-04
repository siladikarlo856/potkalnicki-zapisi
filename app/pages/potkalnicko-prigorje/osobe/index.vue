<script setup lang="ts">
import type { AtlasPersonListResponse } from '~~/shared/types/publicAtlas'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const unit = computed(() => typeof route.query.opcina === 'string' ? route.query.opcina : '')
const { data: page } = await useAtlasFetch<AtlasPersonListResponse>(
  () => `/api/atlas/persons${unit.value ? `?opcina=${encodeURIComponent(unit.value)}` : ''}`
)

const proposalOpen = ref(false)
const units = computed(() => [{ slug: '', label: t('pz.persons.filterAll') }, ...(page.value?.municipalities ?? [])])

function selectUnit(slug: string) {
  router.replace({ query: slug ? { opcina: slug } : {} })
}

useSeoMeta({
  title: () => `${t('pz.persons.seoTitle')} · Potkalnički zapisi`,
  description: () => t('pz.persons.intro')
})
</script>

<template>
  <div v-if="page">
    <UPageHero
      :title="t('pz.persons.title')"
      :description="t('pz.persons.intro')"
      :ui="{ container: 'py-12 sm:py-16' }"
    />

    <UPageSection :ui="{ root: 'border-t border-default' }">
      <div
        v-if="page.municipalities.length > 1 || unit"
        class="mb-4 flex flex-wrap gap-2"
        role="group"
        :aria-label="t('pz.persons.filterUnit')"
        data-testid="persons-filter"
      >
        <UButton
          v-for="option in units"
          :key="option.slug"
          :label="option.label"
          size="sm"
          :color="option.slug === unit ? 'primary' : 'neutral'"
          :variant="option.slug === unit ? 'solid' : 'outline'"
          :aria-pressed="option.slug === unit"
          :data-testid="`persons-filter-${option.slug || 'all'}`"
          @click="selectUnit(option.slug)"
        />
      </div>

      <PersonsList
        v-if="page.persons.length"
        :persons="page.persons"
        testid="persons-list"
        :aria-label="t('pz.persons.listLabel')"
      />
      <p
        v-else
        class="text-sm text-muted"
        data-testid="persons-empty"
      >
        {{ unit ? t('pz.persons.emptyUnit') : t('pz.persons.empty') }}
      </p>
    </UPageSection>

    <UPageSection :ui="{ root: 'border-t border-default' }">
      <div class="flex flex-wrap gap-3">
        <UButton
          :label="t('pz.persons.suggest')"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          aria-haspopup="dialog"
          data-testid="persons-suggest"
          @click="proposalOpen = true"
        />
      </div>
      <p class="mt-3 text-xs text-muted">
        {{ t('pz.persons.onlyDeceased') }}
      </p>
      <HeritageSuggestDialog
        v-model:open="proposalOpen"
        kind="person"
        mode="proposal"
      />
    </UPageSection>
  </div>
</template>
