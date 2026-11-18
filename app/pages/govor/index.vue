<script setup lang="ts">
import type { PublicWords } from '~~/shared/utils/word'
import { contentFold } from '~~/shared/utils/content/common'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()

const { data: payload } = await useFetch<PublicWords>('/api/heritage/words', { query: { limit: 100 } })

const query = ref('')

const filtered = computed(() => {
  const q = contentFold(query.value.trim())
  const words = payload.value?.words ?? []
  if (!q) return words
  return words.filter(w => contentFold(w.headword).includes(q) || contentFold(w.meaning.hr).includes(q))
})

const groups = computed(() => {
  const byLetter = new Map<string, typeof filtered.value>()
  for (const word of filtered.value) {
    const letter = (word.headword.trim()[0] ?? '#').toLocaleUpperCase('hr')
    const bucket = byLetter.get(letter) ?? []
    bucket.push(word)
    byLetter.set(letter, bucket)
  }
  return [...byLetter.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'hr'))
    .map(([letter, words]) => ({
      letter,
      words: [...words].sort((a, b) => a.headword.localeCompare(b.headword, 'hr'))
    }))
})

useSeoMeta({
  title: () => `${t('pz.speech.seoTitle')} · Potkalnički zapisi`,
  description: () => t('pz.home.discovery.speech.description')
})
</script>

<template>
  <div data-testid="speech-index">
    <UPageHero
      :title="t('pz.speech.title')"
      :description="t('pz.home.discovery.speech.description')"
      :ui="{ container: 'py-12 sm:py-16' }"
    />

    <UPageSection :ui="{ root: 'border-t border-default' }">
      <UInput
        v-model="query"
        :placeholder="t('pz.speech.searchPlaceholder')"
        icon="i-lucide-search"
        data-testid="speech-search"
      />

      <p
        v-if="!groups.length"
        class="mt-4 text-sm text-muted"
        data-testid="speech-empty"
      >
        {{ t('pz.speech.empty') }}
      </p>

      <div
        v-for="group in groups"
        :key="group.letter"
        class="mt-8"
        :data-testid="`speech-letter-${group.letter}`"
      >
        <h2 class="text-lg font-semibold text-highlighted">
          {{ group.letter }}
        </h2>
        <ul class="mt-2 divide-y divide-default rounded-lg ring ring-default">
          <li
            v-for="word in group.words"
            :key="word.id"
          >
            <ULink
              v-if="word.slug"
              :to="localePath(wordArchivePagePath(word.slug))"
              class="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm hover:bg-elevated/40"
            >
              <span class="font-medium text-highlighted">{{ word.headword }}</span>
              <span class="text-muted">{{ word.meaning.hr }}</span>
            </ULink>
            <div
              v-else
              class="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm"
            >
              <span class="font-medium text-highlighted">{{ word.headword }}</span>
              <span class="text-muted">{{ word.meaning.hr }}</span>
            </div>
          </li>
        </ul>
      </div>
    </UPageSection>
  </div>
</template>
