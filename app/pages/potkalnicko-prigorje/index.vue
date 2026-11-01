<script setup lang="ts">
import type { PageFeatureProps } from '@nuxt/ui'
import { quizTopics } from '~/data/heritageQuizzes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { locale, t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('heritage.title'),
  ogTitle: () => t('heritage.title'),
  ogDescription: () => t('heritage.description'),
  description: () => t('heritage.description')
})

const features = computed<PageFeatureProps[]>(() => [
  { icon: 'i-lucide-layers', title: t('heritage.coming.cards.title'), description: t('heritage.coming.cards.description') },
  { icon: 'i-lucide-circle-help', title: t('heritage.coming.quizzes.title'), description: t('heritage.coming.quizzes.description') },
  { icon: 'i-lucide-map', title: t('heritage.coming.map.title'), description: t('heritage.coming.map.description') },
  { icon: 'i-lucide-book-open', title: t('heritage.coming.stories.title'), description: t('heritage.coming.stories.description') }
])

const points = computed(() => [
  { icon: 'i-lucide-shield-check', label: t('heritage.form.reviewed') },
  { icon: 'i-lucide-user-round', label: t('heritage.form.nameOptional') },
  { icon: 'i-lucide-log-in', label: t('heritage.form.noSignIn') }
])

const route = useRoute()
const { words } = useHeritage()
const topicCards = quizTopics.filter(topic => topic.slug !== 'rijeci')

// A card can link to this form with its word ID. Wait for the active database words to load;
// the form itself never overwrites anything the visitor has already typed.
const prefillWord = computed(() => {
  const wordId = route.query.rijec
  if (typeof wordId !== 'string') return undefined
  return words.value.find(entry => entry.id === wordId)?.headword
})
</script>

<template>
  <div>
    <UPageHero
      :title="t('heritage.title')"
      :links="[
        { label: t('challenge.try'), to: localePath('/potkalnicko-prigorje/izazov'), trailingIcon: 'i-lucide-arrow-right', color: 'primary', variant: 'solid' },
        { label: t('heritage.share'), to: '#doprinos', icon: 'i-lucide-message-square-plus', size: 'xl' },
        { label: t('heritage.coming.jump'), to: '#uskoro', trailingIcon: 'i-lucide-arrow-down', color: 'neutral', variant: 'subtle', size: 'xl' }
      ]"
      :ui="{ container: 'py-16 sm:py-24 lg:py-28', title: 'text-4xl sm:text-6xl', footer: 'print:hidden' }"
    >
      <template #headline>
        <span class="flex flex-wrap justify-center gap-2">
          <UBadge
            :label="t('heritage.badge')"
            icon="i-lucide-sparkles"
            variant="subtle"
          />
          <UBadge
            :label="t('heritage.status')"
            icon="i-lucide-construction"
            color="neutral"
            variant="outline"
          />
        </span>
      </template>

      <template #description>
        <span class="block text-sm text-muted">{{ t('heritage.nameNote') }}</span>
        <span class="mt-4 block">{{ t('heritage.description') }}</span>
      </template>
    </UPageHero>

    <UPageSection
      id="igre"
      :title="t('heritage.games.title')"
      :description="t('heritage.games.description')"
      :ui="{ root: 'border-t border-default' }"
      data-testid="quiz-catalog"
    >
      <UCard
        class="mb-6 overflow-hidden"
        data-testid="quiz-hero"
        variant="soft"
      >
        <div class="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div class="space-y-3">
            <UBadge
              :label="t('heritage.games.heroEyebrow')"
              icon="i-lucide-sparkles"
              variant="subtle"
            />
            <div class="space-y-2">
              <h2 class="text-3xl font-bold text-highlighted sm:text-4xl">
                {{ t('heritage.games.heroTitle') }}
              </h2>
              <p class="max-w-2xl text-muted">
                {{ t('heritage.games.heroDescription') }}
              </p>
            </div>
          </div>
          <UButton
            :to="localePath('/potkalnicko-prigorje/igre/kviz')"
            :label="t('heritage.games.playHero')"
            trailing-icon="i-lucide-arrow-right"
            size="xl"
          />
        </div>
      </UCard>

      <h2 class="mb-4 text-2xl font-semibold text-highlighted">
        {{ t('heritage.games.topicsTitle') }}
      </h2>
      <p class="mb-6 text-muted">
        {{ t('heritage.games.topicsDescription') }}
      </p>
      <UPageGrid>
        <UPageCard
          v-for="topic in topicCards"
          :key="topic.slug"
          :data-testid="`topic-card-${topic.slug}`"
          :icon="topic.icon"
          :title="t(topic.titleKey)"
          :description="t(topic.descriptionKey)"
          :to="localePath(`/potkalnicko-prigorje/igre/${topic.slug}`)"
          :ui="{ root: 'h-full' }"
          variant="outline"
        >
          <template #title>
            <h3>{{ t(topic.titleKey) }}</h3>
          </template>
          <template #footer>
            <span class="flex items-center gap-1 text-sm font-medium text-primary">
              {{ t('heritage.games.openTopic') }}
              <UIcon
                name="i-lucide-arrow-right"
                class="size-4"
              />
            </span>
          </template>
        </UPageCard>
      </UPageGrid>
    </UPageSection>

    <UPageSection
      id="igraj"
      :title="t('challenge.chooseTitle')"
      :description="t('challenge.chooseIntro')"
      :ui="{ root: 'border-t border-default' }"
    >
      <div
        class="grid gap-6 sm:grid-cols-2"
        data-testid="heritage-mode-choice"
      >
        <UCard>
          <div class="space-y-4">
            <UIcon
              name="i-lucide-book-open"
              class="size-8 text-primary"
            />
            <h2 class="text-2xl font-semibold">
              {{ t('challenge.learning') }}
            </h2>
            <p class="text-muted">
              {{ t('challenge.learningHelp') }}
            </p>
            <UButton :to="localePath('/potkalnicko-prigorje/igre/kartice')">
              {{ t('challenge.learningCards') }}
            </UButton>
          </div>
        </UCard>
        <UCard>
          <div class="space-y-4">
            <UIcon
              name="i-lucide-flag"
              class="size-8 text-primary"
            />
            <h2 class="text-2xl font-semibold">
              {{ t('challenge.modeChallenge') }}
            </h2>
            <p class="text-muted">
              {{ t('challenge.challengeHelp') }}
            </p>
            <div
              class="grid gap-3 sm:grid-cols-2"
              data-testid="challenge-mode-choice"
            >
              <UCard
                variant="soft"
                class="h-full"
              >
                <div class="flex h-full flex-col gap-3">
                  <div class="flex items-center justify-between gap-2">
                    <UIcon
                      name="i-lucide-zap"
                      class="size-6 text-primary"
                    />
                    <UBadge
                      :label="t('challenge.quick')"
                      color="primary"
                      variant="subtle"
                    />
                  </div>
                  <h3 class="font-semibold">
                    {{ t('challenge.quick') }}
                  </h3>
                  <p class="text-sm text-muted">
                    {{ t('challenge.quickHelp') }}
                  </p>
                  <UButton
                    :to="localePath('/potkalnicko-prigorje/igre/kviz')"
                    trailing-icon="i-lucide-arrow-right"
                    class="mt-auto"
                  >
                    {{ t('challenge.quick') }}
                  </UButton>
                </div>
              </UCard>
              <UCard
                variant="outline"
                class="h-full"
              >
                <div class="flex h-full flex-col gap-3">
                  <div class="flex items-center justify-between gap-2">
                    <UIcon
                      name="i-lucide-sliders-horizontal"
                      class="size-6 text-muted"
                    />
                    <UBadge
                      :label="t('challenge.comingSoon')"
                      color="neutral"
                      variant="subtle"
                    />
                  </div>
                  <h3 class="font-semibold">
                    {{ t('challenge.custom') }}
                  </h3>
                  <p class="text-sm text-muted">
                    {{ t('challenge.customHelp') }}
                  </p>
                  <UButton
                    disabled
                    color="neutral"
                    variant="outline"
                    class="mt-auto"
                  >
                    {{ t('challenge.comingSoon') }}
                  </UButton>
                </div>
              </UCard>
            </div>
          </div>
        </UCard>
      </div>
    </UPageSection>

    <UPageSection
      id="uskoro"
      :title="t('heritage.coming.title')"
      :description="locale === 'en' ? t('heritage.coming.gameNote') : undefined"
      :links="[
        { label: t('heritage.coming.tryGame'), to: localePath('/potkalnicko-prigorje/igre/kartice'), trailingIcon: 'i-lucide-arrow-right', color: 'neutral', variant: 'subtle' },
        { label: t('quiz.tryQuiz'), to: localePath('/potkalnicko-prigorje/igre/kviz'), trailingIcon: 'i-lucide-arrow-right', color: 'primary', variant: 'subtle' }
      ]"
      :ui="{ root: 'scroll-mt-(--ui-header-height) border-t border-default', features: 'sm:grid-cols-2 lg:grid-cols-4', footer: 'print:hidden' }"
    >
      <template #features>
        <UPageFeature
          v-for="feature in features"
          :key="feature.icon"
          v-bind="feature"
          as="li"
        >
          <template #title>
            <h3>{{ feature.title }}</h3>
          </template>
        </UPageFeature>
      </template>
    </UPageSection>

    <UPageSection
      id="doprinos"
      orientation="horizontal"
      :title="t('heritage.form.title')"
      :description="t('heritage.form.description')"
      :ui="{ root: 'scroll-mt-(--ui-header-height) border-t border-default', container: 'lg:items-start' }"
    >
      <template #body>
        <ul class="flex flex-col gap-2.5">
          <li
            v-for="point in points"
            :key="point.icon"
            class="flex items-center gap-2 text-sm text-default"
          >
            <UIcon
              :name="point.icon"
              class="size-5 shrink-0 text-primary"
            />
            {{ point.label }}
          </li>
        </ul>
      </template>

      <HeritageSubmissionForm :word="prefillWord" />
    </UPageSection>
  </div>
</template>
