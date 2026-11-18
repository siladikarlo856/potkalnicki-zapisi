<script setup lang="ts">
import type { AtlasIntangibleResponse } from '~~/shared/types/publicIntangible'
import { pzRoutes } from '~~/shared/utils/appRoutes'

// One Story, Custom or Folk text: /price-i-obicaji/prica/<slug>, /obicaj/<slug> or /usmeni-tekst/<slug>.
definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const { data: payload } = await useAtlasFetch<AtlasIntangibleResponse>(
  () => `/api/atlas/intangible/${route.params.kind}/${route.params.slug}`
)
const record = computed(() => payload.value?.record)

const formatDate = (iso: string) => new Intl.DateTimeFormat('hr-HR', { dateStyle: 'long' }).format(new Date(iso))
const memoryTo = computed(() => localePath({ path: pzRoutes.contribute, query: { vrsta: 'sjecanje' } }))

const periodLabelKey = computed(() => record.value?.kind === 'custom' ? 'pz.intangible.practised' : 'pz.intangible.setIn')
const sources = computed(() => (record.value?.sources ?? []).map(source => ({ label: source.title, href: source.url ?? undefined })))
const description = computed(() => record.value?.excerpt?.slice(0, 160) || t('pz.intangible.intro'))
const sensitiveRevealed = ref(false)
const categoryLabel = computed(() => {
  if (!record.value) return ''
  return record.value.kind === 'folk_text'
    ? record.value.typeLabel
    : `${record.value.kindLabel} · ${record.value.typeLabel}`
})

useSeoMeta({
  title: () => record.value?.title ?? '',
  ogTitle: () => record.value ? `${record.value.title} · Potkalnički zapisi` : '',
  description: () => description.value,
  ogDescription: () => description.value,
  robots: () => record.value?.noindex ? 'noindex, follow' : 'index, follow'
})
</script>

<template>
  <div
    v-if="record"
    class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-8 px-4 py-6 lg:px-12 lg:py-12"
    :data-testid="`intangible-${record.kind}-page`"
  >
    <div class="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_var(--pz-side-panel)] lg:gap-x-12">
      <header class="flex max-w-(--pz-measure) flex-col gap-3">
        <PzBackPill :to="localePath(pzRoutes.intangible)">
          {{ t('pz.intangible.title') }}
        </PzBackPill>
        <p
          class="pz-overline text-muted"
          data-testid="intangible-overline"
        >
          {{ categoryLabel }}
        </p>
        <h1 class="pz-h1 wrap-anywhere text-highlighted lg:pz-display">
          {{ record.title }}
        </h1>
        <dl
          v-if="record.narrators.length || record.collectors.length || record.authors.length"
          class="pz-body flex flex-col gap-1"
          data-testid="intangible-people"
        >
          <div
            v-if="record.narrators.length"
            class="flex flex-wrap gap-x-2"
          >
            <dt class="text-muted">
              {{ t('pz.intangible.narrators') }}:
            </dt>
            <dd class="m-0 font-medium">
              <template
                v-for="(narrator, index) in record.narrators"
                :key="narrator.id"
              >
                <span v-if="index">, </span>
                <ULink
                  :to="localePath(narrator.path)"
                  class="text-primary"
                  data-testid="intangible-narrator"
                >{{ narrator.label }}</ULink>
              </template>
            </dd>
          </div>
          <div
            v-if="record.collectors.length"
            class="flex flex-wrap gap-x-2"
          >
            <dt class="text-muted">
              {{ t('pz.intangible.collectors') }}:
            </dt>
            <dd class="m-0 font-medium">
              <template
                v-for="(collector, index) in record.collectors"
                :key="collector.id"
              >
                <span v-if="index">, </span>
                <ULink
                  :to="localePath(collector.path)"
                  class="text-primary"
                  data-testid="intangible-collector"
                >{{ collector.label }}</ULink>
              </template>
            </dd>
          </div>
          <div
            v-if="record.authors.length"
            class="flex flex-wrap gap-x-2"
          >
            <dt class="text-muted">
              {{ t('pz.intangible.authors') }}:
            </dt>
            <dd class="m-0 font-medium">
              <template
                v-for="(author, index) in record.authors"
                :key="author.id"
              >
                <span v-if="index">, </span>
                <ULink
                  :to="localePath(author.path)"
                  class="text-primary"
                  data-testid="intangible-author"
                >{{ author.name }}</ULink>
              </template>
            </dd>
          </div>
        </dl>
      </header>

      <PzFactPanel
        class="max-lg:order-last lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
        :sources="sources"
      >
        <template #facts>
          <dl
            class="pz-label grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 font-normal"
            data-testid="intangible-facts"
          >
            <dt class="text-muted">
              {{ t('pz.intangible.type') }}
            </dt>
            <dd class="m-0 font-medium">
              {{ record.typeLabel }}
            </dd>
            <template v-if="record.occasion">
              <dt class="text-muted">
                {{ t('pz.intangible.occasion') }}
              </dt>
              <dd
                class="m-0 font-medium"
                data-testid="intangible-occasion"
              >
                {{ record.occasion }}
              </dd>
            </template>
            <template v-if="record.recordedIn.length">
              <dt class="text-muted">
                {{ t('pz.intangible.recordedIn') }}
              </dt>
              <dd
                class="m-0 font-medium"
                data-testid="intangible-recorded-in"
              >
                <template
                  v-for="(place, index) in record.recordedIn"
                  :key="place.id"
                >
                  <span v-if="index">, </span>
                  <ULink
                    :to="localePath(place.path)"
                    class="text-primary underline underline-offset-2"
                  >{{ place.name }}</ULink>
                </template>
              </dd>
            </template>
            <template v-if="record.about.length">
              <dt class="text-muted">
                {{ t('pz.intangible.about') }}
              </dt>
              <dd
                class="m-0 font-medium"
                data-testid="intangible-about"
              >
                <template
                  v-for="(place, index) in record.about"
                  :key="place.id"
                >
                  <span v-if="index">, </span>
                  <ULink
                    :to="localePath(place.path)"
                    class="text-primary underline underline-offset-2"
                  >{{ place.name }}</ULink>
                </template>
              </dd>
            </template>
            <template v-if="record.recordedOn">
              <dt class="text-muted">
                {{ t('pz.intangible.recordedOn') }}
              </dt>
              <dd
                class="m-0 font-medium"
                data-testid="intangible-recorded-on"
              >
                {{ record.recordedOn }}
              </dd>
            </template>
            <template v-if="record.period">
              <dt class="text-muted">
                {{ t(periodLabelKey) }}
              </dt>
              <dd
                class="m-0 font-medium"
                data-testid="intangible-period"
              >
                {{ record.period }}
              </dd>
            </template>
          </dl>
        </template>
        <template #trust>
          <IntangibleAttestation :verification="record.verification" />
        </template>
      </PzFactPanel>

      <div class="flex min-w-0 max-w-(--pz-measure) flex-col gap-8">
        <section
          v-if="record.sensitive"
          class="flex flex-col gap-3 rounded-lg border border-warning/50 bg-warning/10 p-4"
          data-testid="intangible-sensitive"
        >
          <div class="flex flex-col gap-1">
            <h2 class="pz-h2 text-highlighted">
              {{ t('pz.intangible.sensitiveTitle') }}
            </h2>
            <p class="pz-body-sm text-default">
              {{ t('pz.intangible.sensitiveHint') }}
            </p>
          </div>
          <UButton
            v-if="!sensitiveRevealed"
            :label="t('pz.intangible.sensitiveReveal')"
            color="neutral"
            variant="outline"
            class="self-start"
            data-testid="intangible-sensitive-reveal"
            @click="sensitiveRevealed = true"
          />
        </section>

        <section
          v-if="record.steps.length"
          class="flex flex-col gap-3"
          data-testid="intangible-steps"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.intangible.steps') }}
          </h2>
          <ol class="flex flex-col gap-3 ps-6">
            <li
              v-for="(step, index) in record.steps"
              :key="index"
              class="pz-body list-decimal ps-2 text-default"
            >
              {{ step }}
            </li>
          </ol>
        </section>

        <section
          v-if="record.textLocal && (!record.sensitive || sensitiveRevealed)"
          class="flex flex-col gap-2"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.intangible.textLocal') }}
          </h2>
          <p
            class="pz-body whitespace-pre-line text-default"
            lang="hr"
            data-testid="intangible-text-local"
          >
            {{ record.textLocal }}
          </p>
        </section>

        <section
          v-if="record.textStandard && (!record.sensitive || sensitiveRevealed)"
          class="flex flex-col gap-2"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.intangible.textStandard') }}
          </h2>
          <p
            class="pz-body whitespace-pre-line text-default"
            lang="hr"
            data-testid="intangible-text-standard"
          >
            {{ record.textStandard }}
          </p>
        </section>

        <section
          v-if="record.description"
          class="flex flex-col gap-2"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.intangible.description') }}
          </h2>
          <p
            class="pz-body whitespace-pre-line text-default"
            lang="hr"
            data-testid="intangible-description"
          >
            {{ record.description }}
          </p>
        </section>

        <section
          v-if="record.quotes.length"
          class="flex flex-col gap-3"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.intangible.quotes') }}
          </h2>
          <ul
            class="flex flex-col gap-3"
            data-testid="intangible-quotes"
          >
            <li
              v-for="(quote, index) in record.quotes"
              :key="index"
            >
              <blockquote
                class="pz-body border-s-4 border-accented ps-4 whitespace-pre-line text-default italic"
                lang="hr"
              >
                {{ quote }}
              </blockquote>
            </li>
          </ul>
        </section>

        <section
          v-if="record.custom"
          class="flex flex-col gap-2"
          data-testid="intangible-custom"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.intangible.custom') }}
          </h2>
          <p class="pz-body-sm text-muted">
            {{ t('pz.intangible.customHint') }}
          </p>
          <IntangibleRefList :records="[record.custom]" />
        </section>

        <section
          v-if="record.folkTexts.length"
          class="flex flex-col gap-3"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.intangible.folkTexts') }}
          </h2>
          <IntangibleRefList
            :records="record.folkTexts"
            testid="intangible-folk-texts"
          />
        </section>

        <section
          v-if="record.words.length"
          class="flex flex-col gap-2"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.intangible.words') }}
          </h2>
          <p class="pz-body-sm text-muted">
            {{ t('pz.intangible.wordsHint') }}
          </p>
          <ul
            class="flex flex-wrap gap-2"
            data-testid="intangible-words"
          >
            <li
              v-for="word in record.words"
              :key="word.id"
            >
              <NuxtLink
                v-if="word.path"
                :to="localePath(word.path)"
                class="pz-label inline-flex min-h-(--pz-tap-min) items-center rounded-full border border-accented bg-default px-3.5 text-default no-underline hover:bg-muted"
              >
                {{ word.headword }}
              </NuxtLink>
              <span
                v-else
                class="pz-label inline-flex min-h-(--pz-tap-min) items-center rounded-full border border-accented bg-default px-3.5 text-default"
              >{{ word.headword }}</span>
            </li>
          </ul>
        </section>

        <section
          v-if="record.heritage.length"
          class="flex flex-col gap-3"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.intangible.heritage') }}
          </h2>
          <ul
            class="divide-y divide-default rounded-lg ring ring-default"
            data-testid="intangible-heritage"
          >
            <li
              v-for="item in record.heritage"
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
            </li>
          </ul>
        </section>

        <section
          v-if="record.themes.length"
          class="flex flex-col gap-2"
        >
          <h2 class="pz-h2 text-highlighted">
            {{ t('pz.intangible.themes') }}
          </h2>
          <ul
            class="flex flex-wrap gap-2"
            data-testid="intangible-themes"
          >
            <li
              v-for="theme in record.themes"
              :key="theme.id"
            >
              <NuxtLink
                :to="localePath(theme.path)"
                class="pz-label inline-flex min-h-(--pz-tap-min) items-center rounded-full border border-accented bg-default px-3.5 text-default no-underline hover:bg-muted"
              >
                {{ theme.label }}
              </NuxtLink>
            </li>
          </ul>
        </section>

        <UButton
          :label="t('pz.intangible.contributeMemory')"
          :to="memoryTo"
          icon="i-lucide-message-circle"
          color="neutral"
          variant="outline"
          class="min-h-(--pz-tap-min) max-w-full justify-start self-start text-start whitespace-normal ring-(--ui-border-accented)"
          data-testid="intangible-contribute"
        />

        <div class="flex flex-col gap-1">
          <p
            v-if="record.credits.length"
            class="pz-body-sm text-muted"
            data-testid="intangible-credits"
          >
            {{ t('pz.intangible.credits', { names: record.credits.map(credit => credit.name).join(', ') }) }}
          </p>
          <p
            class="pz-caption text-dimmed"
            data-testid="intangible-updated"
          >
            {{ t('pz.intangible.updatedAt', { date: formatDate(record.updatedAt) }) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
