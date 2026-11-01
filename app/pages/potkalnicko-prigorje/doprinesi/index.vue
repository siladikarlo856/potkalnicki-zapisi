<script setup lang="ts">
import type { SubmissionType } from '~~/shared/utils/submission'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { words } = useHeritage()

type PickerKind = 'word' | 'memory' | 'correction' | 'photo'

const pickerCards: { kind: PickerKind, type?: SubmissionType, soon?: boolean }[] = [
  { kind: 'word', type: 'word' },
  { kind: 'memory', type: 'memory' },
  { kind: 'correction', soon: true },
  { kind: 'photo', soon: true }
]

const selectedKind = computed(() => {
  const raw = route.query.vrsta
  if (raw === 'rijec' || raw === 'rijec-izraz') return 'word' as const
  if (raw === 'sjecanje' || raw === 'prica') return 'memory' as const
  return undefined
})

const fixedType = computed(() => {
  if (selectedKind.value === 'word') return 'word' as SubmissionType
  if (selectedKind.value === 'memory') return 'memory' as SubmissionType
  return undefined
})

const prefillWord = computed(() => {
  const wordId = route.query.rijec
  if (typeof wordId !== 'string') return undefined
  return words.value.find(entry => entry.id === wordId)?.headword
})

function pickerTo(card: typeof pickerCards[number]) {
  if (card.soon || !card.type) return undefined
  const vrsta = card.kind === 'word' ? 'rijec' : 'sjecanje'
  return localePath({ path: '/potkalnicko-prigorje/doprinesi', query: { ...route.query, vrsta } })
}

useSeoMeta({
  title: () => t('pz.contribute.title'),
  ogTitle: () => `${t('pz.contribute.title')} · Potkalnički zapisi`,
  ogDescription: () => t('pz.contribute.intro'),
  description: () => t('pz.contribute.intro')
})
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <div class="mx-auto flex max-w-2xl flex-col gap-8">
      <header v-if="!selectedKind">
        <h1 class="text-3xl font-bold tracking-tight text-highlighted sm:text-4xl">
          {{ t('pz.contribute.title') }}
        </h1>
        <p class="mt-4 text-muted">
          {{ t('pz.contribute.intro') }}
        </p>
      </header>

      <div
        v-if="!selectedKind"
        class="grid gap-4"
        data-testid="contribute-type-picker"
      >
        <UCard
          v-for="card in pickerCards"
          :key="card.kind"
          variant="outline"
          :class="card.soon ? 'opacity-90' : undefined"
        >
          <NuxtLink
            v-if="pickerTo(card)"
            :to="pickerTo(card)!"
            class="block"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-1">
                <h2 class="text-lg font-semibold text-highlighted">
                  {{ t(`pz.contribute.picker.${card.kind}.title`) }}
                </h2>
                <p class="text-sm text-muted">
                  {{ t(`pz.contribute.picker.${card.kind}.description`) }}
                </p>
              </div>
            </div>
          </NuxtLink>
          <div
            v-else
            class="flex items-start justify-between gap-3"
          >
            <div class="space-y-1">
              <h2 class="text-lg font-semibold text-highlighted">
                {{ t(`pz.contribute.picker.${card.kind}.title`) }}
              </h2>
              <p class="text-sm text-muted">
                {{ t(`pz.contribute.picker.${card.kind}.description`) }}
              </p>
            </div>
            <UBadge
              :label="t(`pz.contribute.picker.${card.kind}.badge`)"
              color="neutral"
              variant="subtle"
            />
          </div>
        </UCard>
      </div>

      <div
        v-else
        class="flex flex-col gap-6"
        data-testid="contribute-form"
      >
        <UButton
          :to="localePath('/potkalnicko-prigorje/doprinesi')"
          :label="t('pz.contribute.back')"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="link"
          class="self-start px-0"
        />
        <h2 class="text-2xl font-semibold text-highlighted">
          {{ t(`pz.contribute.picker.${selectedKind}.title`) }}
        </h2>
        <HeritageSubmissionForm
          :word="prefillWord"
          :fixed-type="fixedType"
          hide-type-picker
        />
      </div>
    </div>
  </UContainer>
</template>
