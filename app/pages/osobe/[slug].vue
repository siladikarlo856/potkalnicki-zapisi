<script setup lang="ts">
import type { AtlasPersonResponse } from '~~/shared/types/publicAtlas'
import { pzRoutes } from '~~/shared/utils/appRoutes'
import { personJsonLd } from '~~/shared/utils/personJsonLd'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()
const baseUrl = useRuntimeConfig().public.i18n.baseUrl

const personSlug = computed(() => String(route.params.slug))
const { data: payload } = await useAtlasFetch<AtlasPersonResponse>(() => `/api/atlas/persons/${personSlug.value}`)
const person = computed(() => payload.value?.person)

const correctionOpen = ref(false)
const sourceOpen = ref(false)
const correctionCurrent = computed<Record<string, string | undefined>>(() => person.value
  ? {
      name: person.value.name,
      born: person.value.born ?? '',
      died: person.value.died,
      role: person.value.role,
      bio: person.value.bio ?? ''
    }
  : {})
const formatDate = (iso: string) => new Intl.DateTimeFormat('hr-HR', { dateStyle: 'long' }).format(new Date(iso))

const lifeLine = computed(() => {
  if (!person.value) return ''
  const born = [person.value.born, person.value.bornPlace].filter(Boolean).join(', ')
  const died = [person.value.died, person.value.diedPlace].filter(Boolean).join(', ')
  return [born, died].filter(Boolean).join(' – ')
})

const description = computed(() => person.value
  ? (person.value.bio?.slice(0, 160) || t('pz.persons.seoDescription', { name: person.value.name, years: person.value.years, role: person.value.role }))
  : '')

useSeoMeta({
  title: () => person.value ? `${person.value.name} · Potkalnički zapisi` : '',
  ogTitle: () => person.value ? `${person.value.name} · Potkalnički zapisi` : '',
  description: () => description.value,
  ogDescription: () => description.value,
  robots: () => person.value?.noindex ? 'noindex, follow' : 'index, follow'
})

useHead(() => ({
  script: person.value && !person.value.noindex
    ? [{
        key: 'person-structured-data',
        type: 'application/ld+json',
        innerHTML: JSON.stringify(personJsonLd(person.value, `${baseUrl}${person.value.path}`))
      }]
    : []
}))
</script>

<template>
  <div
    v-if="person"
    class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-8 px-4 py-6 lg:px-12 lg:py-12"
    data-testid="person-page"
  >
    <header class="flex max-w-(--pz-measure) flex-col gap-3">
      <PzBackPill :to="localePath(pzRoutes.persons)">
        {{ t('pz.persons.back') }}
      </PzBackPill>
      <p
        class="pz-overline text-muted"
        data-testid="person-eyebrow"
      >
        {{ t('pz.persons.person') }} · {{ person.place }}
      </p>
      <h1 class="pz-h1 wrap-anywhere text-highlighted lg:pz-display">
        {{ person.name }}
      </h1>
      <p
        v-if="person.role"
        class="pz-body text-muted"
      >
        {{ person.role }}
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <PzVerificationBadge :verification="person.verification" />
        <span class="pz-body-sm text-muted tabular-nums">{{ person.years }}</span>
      </div>
    </header>

    <UPageSection :ui="{ root: 'border-t border-default' }">
      <p
        v-if="lifeLine"
        class="text-sm font-medium text-highlighted"
        data-testid="person-life"
      >
        {{ lifeLine }}
      </p>
      <p
        v-if="person.bio"
        class="mt-3 text-sm leading-relaxed text-default"
        data-testid="person-bio"
      >
        {{ person.bio }}
      </p>
    </UPageSection>

    <UPageSection
      v-if="person.placeGroups.length"
      :title="t('pz.persons.places')"
      :ui="{ root: 'border-t border-default' }"
    >
      <dl
        class="grid gap-3 text-sm sm:grid-cols-2"
        data-testid="person-places"
      >
        <div
          v-for="group in person.placeGroups"
          :key="group.role"
        >
          <dt class="text-muted">
            {{ group.label }}
          </dt>
          <dd class="font-medium text-highlighted">
            <template
              v-for="(place, index) in group.places"
              :key="place.id"
            >
              <span v-if="index">, </span>
              <ULink
                :to="localePath(place.path)"
                class="text-primary"
              >{{ place.name }}</ULink>
            </template>
          </dd>
        </div>
      </dl>
    </UPageSection>

    <UPageSection
      v-if="person.heritage.length"
      :title="t('pz.persons.relatedHeritage')"
      :ui="{ root: 'border-t border-default' }"
    >
      <ul
        class="divide-y divide-default rounded-lg ring ring-default"
        data-testid="person-heritage"
      >
        <li
          v-for="item in person.heritage"
          :key="item.id"
          class="px-4 py-3 text-sm"
        >
          <ULink
            v-if="item.path"
            :to="localePath(item.path)"
            class="font-medium text-primary"
          >
            {{ item.name }}
          </ULink>
          <span
            v-else
            class="font-medium text-highlighted"
          >{{ item.name }}</span>
          <span class="block text-muted">{{ item.relation }}</span>
        </li>
      </ul>
    </UPageSection>

    <UPageSection
      v-if="person.intangible.length"
      :title="t('pz.intangible.fromThisPerson')"
      :ui="{ root: 'border-t border-default' }"
    >
      <IntangibleRefList
        :records="person.intangible"
        testid="person-intangible"
      />
    </UPageSection>

    <UPageSection
      v-if="person.openQuestions"
      :title="t('pz.persons.openQuestions')"
      :ui="{ root: 'border-t border-default' }"
    >
      <p
        class="text-sm leading-relaxed text-default"
        data-testid="person-open-questions"
      >
        {{ person.openQuestions }}
      </p>
    </UPageSection>

    <UPageSection
      :title="t('pz.persons.sources')"
      :ui="{ root: 'border-t border-default' }"
    >
      <div data-testid="person-sources">
        <PzSourceList :sources="person.sources.map(source => source.title)" />
      </div>
    </UPageSection>

    <UPageSection :ui="{ root: 'border-t border-default' }">
      <div class="flex flex-wrap gap-3">
        <UButton
          :label="t('pz.persons.suggestCorrection')"
          icon="i-lucide-pencil"
          color="neutral"
          variant="outline"
          aria-haspopup="dialog"
          data-testid="person-suggest-correction"
          @click="correctionOpen = true"
        />
        <UButton
          :label="t('pz.persons.addSource')"
          icon="i-lucide-book-plus"
          color="neutral"
          variant="outline"
          aria-haspopup="dialog"
          data-testid="person-suggest-source"
          @click="sourceOpen = true"
        />
      </div>
      <p
        class="mt-4 text-xs text-muted"
        data-testid="person-updated"
      >
        {{ t('pz.persons.updatedAt', { date: formatDate(person.updatedAt) }) }}
      </p>
      <HeritageSuggestDialog
        v-model:open="correctionOpen"
        kind="person"
        mode="correction"
        :target="{ id: person.ref, label: person.name }"
        :current="correctionCurrent"
      />
      <HeritageSuggestDialog
        v-model:open="sourceOpen"
        kind="source"
        mode="proposal"
        :prefill="{ note: t('pz.persons.sourceFor', { name: person.name }) }"
      />
      <ULink
        class="mt-4 inline-flex text-sm text-primary"
        :to="localePath(pzRoutes.persons)"
      >
        {{ t('pz.persons.back') }}
      </ULink>
    </UPageSection>
  </div>
</template>
