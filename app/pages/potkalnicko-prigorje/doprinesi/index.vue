<script setup lang="ts">
import type { SubmissionType } from '~~/shared/utils/submission'
import type { ContentTargetResponse, SuggestOptionsResponse } from '~~/shared/types/publicAtlas'
import type { ContributionKind } from '~~/shared/utils/contribution'
import { parseSuggestQuery, suggestQuery } from '~~/shared/utils/suggest'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const NuxtLink = resolveComponent('NuxtLink')
const { words } = useHeritage()

type PickerKind = 'word' | 'memory' | 'heritage_item' | 'area' | 'source' | 'correction' | 'photo'

// Word and memory keep the free-text form; the other cards open the structured corrections and proposals.
const pickerCards: { kind: PickerKind, icon: string, soon?: boolean }[] = [
  { kind: 'word', icon: 'i-lucide-book-open' },
  { kind: 'memory', icon: 'i-lucide-message-circle' },
  { kind: 'heritage_item', icon: 'i-lucide-church' },
  { kind: 'area', icon: 'i-lucide-map-pin' },
  { kind: 'source', icon: 'i-lucide-book-plus' },
  { kind: 'correction', icon: 'i-lucide-pencil' },
  { kind: 'photo', icon: 'i-lucide-camera', soon: true }
]

const suggest = computed(() => parseSuggestQuery(route.query))
const suggestError = computed(() => !!route.query.vrsta && ['ispravak', 'prijedlog'].includes(String(route.query.vrsta)) && !suggest.value)

const correctionRequest = computed(() => {
  const request = suggest.value
  return request?.mode === 'correction' ? request : undefined
})

interface CorrectionTarget { kind: ContributionKind, id: string, label: string, current: Record<string, string | undefined> }

// What a correction is about, by UUID or (for old links) an old id. Words come from the list the page loads.
const { data: correction, status: correctionStatus } = await useAsyncData<CorrectionTarget | null>(
  () => `correction-target-${correctionRequest.value?.kind}-${correctionRequest.value?.id}-${words.value.length}`,
  async () => {
    const request = correctionRequest.value
    if (!request) return null
    if (request.kind === 'word') {
      const word = words.value.find(entry => entry.id === request.id)
      return word
        ? { kind: 'word' as const, id: word.id, label: word.headword, current: { meaningHr: word.meaning.hr ?? '', meaningEn: word.meaning.en ?? '', partOfSpeech: word.partOfSpeech ?? '' } }
        : null
    }
    try {
      const target = await $fetch<ContentTargetResponse>('/api/content/target', { query: { kind: request.kind, id: request.id } })
      if (target.kind === 'heritage_item') {
        const { item } = target
        return { kind: 'heritage_item' as const, id: item.id, label: item.name, current: { name: item.name, categoryKey: item.category.key, settlementId: item.settlement?.id ?? '', locality: item.locality ?? '' } }
      }
      if (target.kind === 'area' && target.area.areaKind === 'settlement') {
        return { kind: 'area' as const, id: target.area.id, label: target.area.name, current: { name: target.area.name } }
      }
    } catch {
      // unknown, gone or not correctable: the page says so below
    }
    return null
  },
  { watch: [correctionRequest, () => words.value.length] }
)

// A proposal can start from a settlement (`naselje=<slug>`) or municipality (`opcina=<slug>`) of the link.
const proposalRequest = computed(() => {
  const request = suggest.value
  return request?.mode === 'proposal' ? request : undefined
})
const { data: options } = await useAsyncData(
  () => `proposal-options-${proposalRequest.value?.settlement ?? ''}-${proposalRequest.value?.municipality ?? ''}`,
  () => (proposalRequest.value?.settlement || proposalRequest.value?.municipality
    ? $fetch<SuggestOptionsResponse>('/api/content/suggest-options')
    : Promise.resolve(null)),
  { watch: [proposalRequest] }
)
const proposalPrefill = computed(() => {
  const request = proposalRequest.value
  const prefill: Record<string, string> = {}
  if (!request || !options.value) return prefill
  const settlement = request.settlement ? options.value.settlements.find(row => row.slug === request.settlement) : undefined
  const municipality = request.municipality ? options.value.municipalities.find(row => row.slug === request.municipality) : undefined
  if (request.kind === 'heritage_item') {
    if (settlement) prefill.settlementId = settlement.id
    else if (municipality) prefill.municipalityId = municipality.id
  } else if (request.kind === 'area' && (municipality || settlement)) {
    prefill.parentId = (municipality ?? options.value.municipalities.find(row => row.id === settlement?.municipalityId))?.id ?? ''
  }
  return prefill
})

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

const showPicker = computed(() => !selectedKind.value && !suggest.value && !suggestError.value)
const correctionMissing = computed(() => !!correctionRequest.value && correctionStatus.value !== 'pending' && !correction.value)

const prefillWord = computed(() => {
  const wordId = route.query.rijec
  if (typeof wordId !== 'string') return undefined
  return words.value.find(entry => entry.id === wordId)?.headword
})

function cardTo(kind: PickerKind) {
  const path = '/potkalnicko-prigorje/doprinesi'
  if (kind === 'word' || kind === 'memory') return localePath({ path, query: { ...route.query, vrsta: kind === 'word' ? 'rijec' : 'sjecanje' } })
  if (kind === 'correction') return localePath({ path, query: { vrsta: 'ispravak' } })
  if (kind === 'photo') return undefined
  return localePath({ path, query: suggestQuery('proposal', kind as ContributionKind) })
}

function pick(kind: ContributionKind, id: string) {
  return navigateTo(localePath({ path: '/potkalnicko-prigorje/doprinesi', query: suggestQuery('correction', kind, { id }) }))
}

function pickerTitle(kind: PickerKind) {
  return kind === 'word' || kind === 'memory' || kind === 'photo' ? t(`pz.contribute.picker.${kind}.title`) : t(`heritage.suggest.picker.${kind}.title`)
}
function pickerDescription(kind: PickerKind) {
  return kind === 'word' || kind === 'memory' || kind === 'photo' ? t(`pz.contribute.picker.${kind}.description`) : t(`heritage.suggest.picker.${kind}.description`)
}

const heading = computed(() => {
  const request = suggest.value
  if (request?.mode === 'correction') return t('heritage.suggest.picker.correction.title')
  if (request?.mode === 'proposal') return t(`heritage.suggest.picker.${request.kind}.title`)
  return selectedKind.value ? t(`pz.contribute.picker.${selectedKind.value}.title`) : ''
})

useSeoMeta({
  title: () => t('pz.contribute.title'),
  ogTitle: () => `${t('pz.contribute.title')} · Potkalnički zapisi`,
  ogDescription: () => t('pz.contribute.intro'),
  description: () => t('pz.contribute.intro')
})
</script>

<template>
  <div class="mx-auto w-full max-w-(--pz-page-max) px-4 py-6 lg:px-12 lg:py-12">
    <div class="flex max-w-(--pz-measure) flex-col gap-8">
      <header
        v-if="showPicker"
        class="flex flex-col gap-3"
      >
        <h1 class="pz-h1 text-highlighted lg:pz-display">
          {{ t('pz.contribute.title') }}
        </h1>
        <p class="pz-body text-muted">
          {{ t('pz.contribute.intro') }}
        </p>
      </header>

      <ul
        v-if="showPicker"
        class="grid grid-cols-2 gap-3"
        data-testid="contribute-type-picker"
      >
        <li
          v-for="card in pickerCards"
          :key="card.kind"
          class="flex"
        >
          <component
            :is="cardTo(card.kind) ? NuxtLink : 'div'"
            :to="cardTo(card.kind)"
            class="flex w-full flex-col gap-2 rounded-(--pz-radius-lg) border p-4 text-default no-underline"
            :class="card.soon
              ? 'border-dashed border-accented bg-muted text-muted'
              : 'border-default bg-default hover:border-accented hover:bg-muted'"
            :aria-disabled="card.soon ? 'true' : undefined"
            :data-testid="`contribute-card-${card.kind}`"
          >
            <span
              class="grid size-10 place-items-center rounded-(--pz-radius-md) bg-accented text-primary"
              aria-hidden="true"
            >
              <UIcon
                :name="card.icon"
                class="size-5"
              />
            </span>
            <h2 class="pz-h3 text-highlighted">
              {{ pickerTitle(card.kind) }}
            </h2>
            <p class="pz-body-sm text-muted">
              {{ pickerDescription(card.kind) }}
            </p>
            <UBadge
              v-if="card.soon"
              :label="t('pz.contribute.tileSoon')"
              color="neutral"
              variant="subtle"
              class="self-start rounded-(--pz-radius-sm)"
            />
          </component>
        </li>
      </ul>

      <UAlert
        v-else-if="suggestError || correctionMissing"
        color="error"
        variant="subtle"
        :title="t('pz.contribute.correctionMissingTarget')"
        icon="i-lucide-circle-alert"
      >
        <template #actions>
          <UButton
            :to="localePath('/potkalnicko-prigorje/doprinesi')"
            :label="t('pz.contribute.back')"
            color="neutral"
            variant="subtle"
          />
        </template>
      </UAlert>

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
        <h2 class="pz-h2 text-highlighted">
          {{ heading }}
        </h2>
        <HeritageSuggestPicker
          v-if="suggest?.mode === 'search'"
          @pick="pick"
        />
        <HeritageSuggestForm
          v-else-if="correction && correctionRequest"
          :key="`correction-${correction.kind}-${correction.id}`"
          :kind="correction.kind"
          mode="correction"
          :target="{ id: correction.id, label: correction.label }"
          :current="correction.current"
        />
        <HeritageSuggestForm
          v-else-if="proposalRequest"
          :key="`proposal-${proposalRequest.kind}-${JSON.stringify(proposalPrefill)}`"
          :kind="proposalRequest.kind"
          mode="proposal"
          :prefill="proposalPrefill"
        />
        <HeritageSubmissionForm
          v-else-if="selectedKind"
          :word="prefillWord"
          :fixed-type="fixedType"
          hide-type-picker
          sticky-bar
        />
      </div>
    </div>
  </div>
</template>
