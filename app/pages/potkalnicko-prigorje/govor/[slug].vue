<script setup lang="ts">
import type { AtlasItemStatus } from '~~/shared/types/atlas'
import type { WordPageResponse } from '~~/shared/types/publicSpeech'
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const wordSlug = computed(() => String(route.params.slug))
const { data: payload } = await useAtlasFetch<WordPageResponse>(() => `/api/heritage/words/${wordSlug.value}`)

const word = computed(() => payload.value?.word)
const related = computed(() => payload.value?.related ?? [])

const correctionOpen = ref(false)

const verification = computed<AtlasItemStatus>(() => word.value?.status === 'verified' ? 'verified' : 'unverified')

const learnLink = computed(() => word.value
  ? localePath(`${pzRoutes.learn}/sesija?kartice=${encodeURIComponent(`word:${word.value.id}`)}`)
  : undefined)

useSeoMeta({
  title: () => word.value ? `${word.value.headword} · ${t('pz.speech.seoTitle')} · Potkalnički zapisi` : '',
  description: () => word.value?.meaning.hr ?? ''
})
</script>

<template>
  <div
    v-if="word"
    data-testid="speech-word-page"
  >
    <UPageHero
      :title="word.headword"
      :ui="{ container: 'py-12 sm:py-16' }"
    >
      <template #headline>
        <span>{{ t('pz.speech.title') }}</span>
      </template>
      <template #description>
        <div class="flex flex-wrap items-center gap-2">
          <PzVerificationBadge :verification="verification" />
          <span
            v-if="word.partOfSpeech"
            class="text-sm text-muted"
          >{{ word.partOfSpeech }}</span>
        </div>
      </template>
    </UPageHero>

    <UPageSection
      :title="t('pz.speech.meaningTitle')"
      :ui="{ root: 'border-t border-default' }"
    >
      <p
        class="text-lg font-medium text-highlighted"
        data-testid="speech-meaning"
      >
        {{ word.meaning.hr }}
      </p>
      <p
        v-if="word.meaning.en"
        class="mt-2 text-sm text-muted"
        lang="en"
      >
        {{ word.meaning.en }}
      </p>
      <p
        v-if="word.note?.hr"
        class="mt-4 text-sm text-default"
      >
        {{ word.note.hr }}
      </p>
    </UPageSection>

    <UPageSection
      :title="t('pz.speech.variantsTitle')"
      :ui="{ root: 'border-t border-default' }"
    >
      <HeritageVariantList
        :entry="word"
        data-testid="speech-variants"
      />
    </UPageSection>

    <UPageSection
      v-if="word.examples?.length"
      :title="t('pz.speech.examplesTitle')"
      :ui="{ root: 'border-t border-default' }"
    >
      <ul class="flex flex-col gap-2 text-sm">
        <li
          v-for="(example, index) in word.examples"
          :key="index"
        >
          <span class="font-medium text-highlighted">{{ example.text }}</span>
          <span
            v-if="example.translation"
            class="text-muted"
          > · {{ example.translation }}</span>
        </li>
      </ul>
    </UPageSection>

    <UPageSection
      v-if="word.sources.length"
      :title="t('pz.speech.sourcesTitle')"
      :ui="{ root: 'border-t border-default' }"
    >
      <ul class="flex flex-col gap-1 text-sm text-default">
        <li
          v-for="source in word.sources"
          :key="source.id"
        >
          {{ source.credit || t('pz.speech.anonymousSource') }}
        </li>
      </ul>
    </UPageSection>

    <UPageSection
      v-if="related.length"
      :title="t('pz.speech.relatedTitle')"
      :ui="{ root: 'border-t border-default' }"
    >
      <ul class="divide-y divide-default rounded-lg ring ring-default">
        <li
          v-for="item in related"
          :key="item.slug"
        >
          <ULink
            :to="localePath(item.path)"
            class="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm hover:bg-elevated/40"
          >
            <span class="font-medium text-highlighted">{{ item.headword }}</span>
            <span class="text-muted">{{ item.meaning }}</span>
          </ULink>
        </li>
      </ul>
    </UPageSection>

    <UPageSection :ui="{ root: 'border-t border-default' }">
      <div class="flex flex-wrap gap-3">
        <UButton
          v-if="learnLink"
          :to="learnLink"
          :label="t('pz.speech.learnWord')"
          icon="i-lucide-graduation-cap"
          color="primary"
          data-testid="speech-learn-word"
        />
        <HeritageWordCorrection
          v-model:open="correctionOpen"
          :entry="word"
        />
      </div>
    </UPageSection>
  </div>
</template>
