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
const variantOpen = ref(false)

const verification = computed<AtlasItemStatus>(() => word.value?.status === 'verified' ? 'verified' : 'unverified')

const learnLink = computed(() => word.value
  ? localePath(`${pzRoutes.learnSession}?kartice=${encodeURIComponent(`word:${word.value.id}`)}`)
  : undefined)

const areaNames = computed(() => new Map((payload.value?.areas ?? []).map(area => [area.id, area.name])))
const exampleSettlement = (areaId?: string) => areaId ? areaNames.value.get(areaId) : undefined

const villageTotal = computed(() => new Set((word.value?.variants ?? []).flatMap(variant => variant.usages.map(usage => usage.areaId))).size)
const facts = computed(() => word.value
  ? [
      { label: t('pz.speech.factType'), value: word.value.partOfSpeech ?? null },
      { label: t('pz.speech.factForms'), value: String(word.value.variants.length) },
      { label: t('pz.speech.factVillages'), value: villageTotal.value ? String(villageTotal.value) : null }
    ]
  : [])
const sources = computed(() => (word.value?.sources ?? []).map(source => ({ label: source.credit || t('pz.speech.anonymousSource') })))
const verificationHelp = computed(() => t(word.value?.status === 'verified' ? 'pz.trust.help.verified' : 'pz.trust.help.unverified'))

useSeoMeta({
  title: () => word.value ? `${word.value.headword} · ${t('pz.speech.seoTitle')} · Potkalnički zapisi` : '',
  description: () => word.value?.meaning.hr ?? ''
})
</script>

<template>
  <div
    v-if="word"
    class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-8 px-4 py-6 lg:px-12 lg:py-12"
    data-testid="speech-word-page"
  >
    <div class="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_var(--pz-side-panel)] lg:gap-x-12">
      <header class="flex max-w-(--pz-measure) flex-col gap-3">
        <PzBackPill :to="localePath(pzRoutes.speech)">
          {{ t('pz.speech.title') }}
        </PzBackPill>
        <p class="pz-overline text-muted">
          {{ [t('pz.speech.title'), word.partOfSpeech].filter(Boolean).join(' · ') }}
        </p>
        <h1
          class="pz-headword wrap-anywhere text-highlighted"
          lang="hr"
        >
          {{ word.headword }}
        </h1>
        <div class="flex flex-wrap items-center gap-2">
          <PzVerificationBadge :verification="verification" />
          <HeritageSampleBadge v-if="word.status === 'placeholder'" />
        </div>
      </header>

      <PzFactPanel
        class="max-lg:[&_[data-testid=pz-fact-panel-actions]]:hidden max-lg:[&_[data-testid=pz-fact-panel-trust]]:hidden lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
        :facts="facts"
        :sources="sources"
      >
        <template #trust>
          <div class="flex flex-col gap-1">
            <div>
              <PzVerificationBadge :verification="verification" />
            </div>
            <p class="pz-caption font-normal text-muted">
              {{ verificationHelp }}
            </p>
          </div>
        </template>
        <template #actions>
          <UButton
            v-if="learnLink"
            :to="learnLink"
            :label="t('pz.speech.learnWord')"
            icon="i-lucide-graduation-cap"
            size="lg"
            block
            data-testid="speech-learn-word"
          />
          <UButton
            :label="t('pz.speech.differentHere')"
            icon="i-lucide-message-circle"
            color="neutral"
            variant="outline"
            size="lg"
            block
            class="ring-(--ui-border-accented)"
            aria-haspopup="dialog"
            data-testid="speech-different-here"
            @click="variantOpen = true"
          />
          <HeritageWordCorrection
            v-model:open="correctionOpen"
            :entry="word"
          />
        </template>
      </PzFactPanel>

      <div class="flex min-w-0 max-w-(--pz-measure) flex-col gap-8">
        <section class="flex flex-col gap-2">
          <h2 class="pz-overline text-muted">
            {{ t('pz.speech.meaningTitle') }}
          </h2>
          <p
            class="font-sans text-[22px]/[30px] font-semibold text-highlighted"
            data-testid="speech-meaning"
          >
            {{ word.meaning.hr }}
          </p>
          <p
            v-if="word.meaning.en"
            class="pz-body-sm text-muted"
            lang="en"
          >
            {{ word.meaning.en }}
          </p>
          <p
            v-if="word.note?.hr"
            class="pz-body text-default"
          >
            {{ word.note.hr }}
          </p>
          <ul
            v-if="word.examples?.length"
            class="mt-2 flex flex-col gap-3"
            data-testid="speech-examples"
          >
            <li
              v-for="(example, index) in word.examples"
              :key="index"
              class="border-s-2 border-accented ps-4"
            >
              <PzQuote
                :dialect="example.text"
                :rendering="example.translation"
              />
              <p
                v-if="exampleSettlement(example.areaId)"
                class="pz-caption font-normal text-muted"
              >
                {{ exampleSettlement(example.areaId) }}
              </p>
            </li>
          </ul>
        </section>

        <section class="flex flex-col gap-4">
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.speech.variantsTitle') }}
          </h2>
          <div data-testid="speech-variants">
            <PzVariantList
              :entry="word"
              :areas="payload?.areas ?? []"
            />
          </div>
          <UButton
            :label="t('pz.speech.differentHere')"
            icon="i-lucide-message-circle"
            color="neutral"
            variant="outline"
            size="lg"
            block
            class="ring-(--ui-border-accented) lg:hidden"
            aria-haspopup="dialog"
            data-testid="speech-different-here-mobile"
            @click="variantOpen = true"
          />
        </section>

        <section
          v-if="related.length"
          class="flex flex-col gap-2"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.speech.relatedTitle') }}
          </h2>
          <ul class="flex flex-wrap gap-2">
            <li
              v-for="item in related"
              :key="item.slug"
            >
              <NuxtLink
                :to="localePath(item.path)"
                class="pz-caption inline-flex min-h-8 items-center rounded-full border border-accented bg-default px-3 text-default no-underline hover:bg-muted"
                :title="item.meaning"
              >
                <span lang="hr">{{ item.headword }}</span>
              </NuxtLink>
            </li>
          </ul>
        </section>

        <UButton
          :label="t('heritage.suggest.wordCorrection')"
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          class="self-start lg:hidden"
          aria-haspopup="dialog"
          data-testid="word-suggest-correction-mobile"
          @click="correctionOpen = true"
        />
      </div>
    </div>

    <PzStickyActionBar v-if="learnLink">
      <UButton
        :to="learnLink"
        :label="t('pz.speech.learnWord')"
        icon="i-lucide-graduation-cap"
        size="lg"
        data-testid="speech-learn-word-mobile"
      />
    </PzStickyActionBar>

    <HeritageVariantDialog
      v-model:open="variantOpen"
      :entry="word"
    />
  </div>
</template>
