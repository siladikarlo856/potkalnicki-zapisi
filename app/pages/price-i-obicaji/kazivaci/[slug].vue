<script setup lang="ts">
import type { AtlasNarratorResponse } from '~~/shared/types/publicIntangible'
import { pzRoutes } from '~~/shared/utils/appRoutes'

// One narrator: who they are in public (their name only when they agreed to it, otherwise the description an editor
// wrote) and everything they told or wrote down.
definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const { data: payload } = await useAtlasFetch<AtlasNarratorResponse>(() => `/api/atlas/narrators/${route.params.slug}`)
const narrator = computed(() => payload.value?.narrator)
const told = computed(() => payload.value?.told ?? [])
const collected = computed(() => payload.value?.collected ?? [])

const details = computed(() => {
  const n = narrator.value
  if (!n) return []
  return [
    ...(n.bornYear !== null ? [{ key: 'born', text: t('pz.intangible.narrator.born', { year: n.bornYear }) }] : []),
    ...(n.living === false ? [{ key: 'deceased', text: t('pz.intangible.narrator.deceased') }] : [])
  ]
})

const description = computed(() => narrator.value ? t('pz.intangible.narrator.seoDescription', { name: narrator.value.label }) : '')

useSeoMeta({
  title: () => narrator.value ? t('pz.intangible.narrator.seoTitle', { name: narrator.value.label }) : '',
  ogTitle: () => narrator.value ? `${t('pz.intangible.narrator.seoTitle', { name: narrator.value.label })} · Potkalnički zapisi` : '',
  description: () => description.value,
  ogDescription: () => description.value,
  robots: () => narrator.value?.noindex ? 'noindex, follow' : 'index, follow'
})
</script>

<template>
  <div
    v-if="narrator"
    class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-8 px-4 py-6 lg:px-12 lg:py-12"
    data-testid="narrator-page"
  >
    <header class="flex max-w-(--pz-measure) flex-col gap-3">
      <PzBackPill :to="localePath(pzRoutes.intangible)">
        {{ t('pz.intangible.title') }}
      </PzBackPill>
      <div
        class="grid size-16 place-items-center rounded-full bg-accented font-display text-2xl font-bold text-primary"
        aria-hidden="true"
      >
        {{ narrator.label.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toLocaleUpperCase('hr') }}
      </div>
      <p class="pz-overline text-muted">
        {{ t('pz.intangible.narrator.overline') }}
      </p>
      <h1
        class="pz-h1 wrap-anywhere text-highlighted lg:pz-display"
        data-testid="narrator-name"
      >
        {{ narrator.label }}
      </h1>
      <p
        v-if="narrator.named && narrator.description"
        class="pz-body text-muted"
        data-testid="narrator-description"
      >
        {{ narrator.description }}
      </p>
      <p
        v-if="!narrator.named"
        class="pz-body-sm text-muted"
        data-testid="narrator-anonymous"
      >
        {{ t('pz.intangible.narrator.anonymousNote') }}
      </p>
      <ul
        v-if="details.length"
        class="pz-body flex flex-wrap gap-x-4 text-muted"
        data-testid="narrator-details"
      >
        <li
          v-for="detail in details"
          :key="detail.key"
        >
          {{ detail.text }}
        </li>
      </ul>
      <dl
        v-if="narrator.settlement || narrator.person"
        class="pz-body grid gap-2 sm:grid-cols-2"
      >
        <div
          v-if="narrator.settlement"
          class="flex flex-wrap gap-x-2"
        >
          <dt class="text-muted">
            {{ t('pz.intangible.narrator.homePlace') }}:
          </dt>
          <dd class="m-0 font-medium">
            <ULink
              :to="localePath(narrator.settlement.path)"
              class="text-primary"
            >
              {{ narrator.settlement.name }}
            </ULink>
          </dd>
        </div>
        <div
          v-if="narrator.person"
          class="flex flex-wrap gap-x-2"
        >
          <dt class="text-muted">
            {{ t('pz.intangible.narrator.isPerson') }}:
          </dt>
          <dd class="m-0 font-medium">
            <ULink
              :to="localePath(narrator.person.path)"
              class="text-primary"
              data-testid="narrator-person"
            >
              {{ narrator.person.name }}
            </ULink>
          </dd>
        </div>
      </dl>
    </header>

    <section
      v-if="told.length"
      class="flex flex-col gap-4"
    >
      <h2 class="pz-h2 text-highlighted">
        {{ t('pz.intangible.narrator.told') }}
      </h2>
      <IntangibleRecordList
        :records="told"
        testid="narrator-told"
      />
    </section>

    <section
      v-if="collected.length"
      class="flex flex-col gap-4"
    >
      <h2 class="pz-h2 text-highlighted">
        {{ t('pz.intangible.narrator.collected') }}
      </h2>
      <IntangibleRecordList
        :records="collected"
        testid="narrator-collected"
      />
    </section>

    <p
      v-if="!told.length && !collected.length"
      class="pz-body text-muted"
      data-testid="narrator-empty"
    >
      {{ t('pz.intangible.narrator.empty') }}
    </p>
  </div>
</template>
