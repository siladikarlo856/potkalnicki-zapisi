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

const availableLetters = computed(() => groups.value.map(group => group.letter))

useSeoMeta({
  title: () => `${t('pz.speech.seoTitle')} · Potkalnički zapisi`,
  description: () => t('pz.home.discovery.speech.description')
})
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-6 px-4 py-6 lg:px-12 lg:py-12"
    data-testid="speech-index"
  >
    <PageHead
      :title="t('pz.speech.title')"
      :lead="t('pz.home.discovery.speech.description')"
    />

    <section
      class="flex max-w-(--pz-measure) flex-col gap-5"
      aria-label="Rječnik"
    >
      <UInput
        v-model="query"
        :placeholder="t('pz.speech.searchPlaceholder')"
        icon="i-lucide-search"
        data-testid="speech-search"
        type="search"
      />
      <PzAlphabetIndex
        v-if="!query"
        :available="availableLetters"
        label="Riječi po početnom slovu"
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
            <PzWordRow
              v-if="word.slug"
              :to="localePath(wordArchivePagePath(word.slug))"
              :word="word.headword"
              :meaning="word.meaning.hr"
              :pos="word.partOfSpeech"
              class="px-4"
            />
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
    </section>
  </div>
</template>
