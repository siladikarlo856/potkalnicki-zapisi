<script setup lang="ts">
import type { AtlasPersonListResponse } from '~~/shared/types/publicAtlas'
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const localePath = useLocalePath()

const unit = computed(() => typeof route.query.opcina === 'string' ? route.query.opcina : '')
const { data: page } = await useAtlasFetch<AtlasPersonListResponse>(
  () => `/api/atlas/persons${unit.value ? `?opcina=${encodeURIComponent(unit.value)}` : ''}`
)

const proposalOpen = ref(false)
const units = computed(() => [{ slug: '', label: t('pz.persons.filterAll') }, ...(page.value?.municipalities ?? [])])
const playReady = computed(() => (page.value?.total ?? 0) >= 4)
const availableLetters = computed(() => [...new Set((page.value?.persons ?? []).map(person => person.name.split(/\s+/).at(-1)?.[0]?.toLocaleUpperCase('hr') ?? ''))])

function selectUnit(slug: string) {
  router.replace({ query: slug ? { opcina: slug } : {} })
}

useSeoMeta({
  title: () => `${t('pz.persons.seoTitle')} · Potkalnički zapisi`,
  description: () => t('pz.persons.intro')
})
</script>

<template>
  <div
    v-if="page"
    class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-6 px-4 py-6 lg:px-12 lg:py-12"
    data-testid="persons-page"
  >
    <PageHead
      :title="t('pz.persons.title')"
      :lead="t('pz.persons.intro')"
    />

    <section class="flex flex-col gap-5">
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

      <PzAlphabetIndex
        v-if="availableLetters.length"
        :available="availableLetters"
        label="Osobe po prezimenu"
      />

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
    </section>

    <section class="flex flex-col gap-4 border-t border-default pt-6">
      <div class="flex flex-wrap gap-3">
        <UButton
          v-if="playReady"
          :to="localePath(`${pzRoutes.learn}?teme=osobe`)"
          :label="t('pz.persons.learn')"
          icon="i-lucide-graduation-cap"
          color="primary"
        />
        <UButton
          v-if="playReady"
          :to="localePath(pzRoutes.tkoJeTo)"
          :label="t('pz.persons.whoIsIt')"
          icon="i-lucide-user-round"
          color="neutral"
          variant="outline"
        />
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
    </section>
  </div>
</template>
