<script setup lang="ts">
import { quizTopics, quizzesForTopic, type QuizMechanic } from '~/data/heritageQuizzes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const topic = quizTopics.find(item => item.slug === route.params.tema)
if (!topic) {
  throw createError({ statusCode: 404, statusMessage: 'Quiz topic not found' })
}

const quizzes = quizzesForTopic(topic.slug)
const mechanicTranslationKey: Record<QuizMechanic, string> = {
  'multiple-choice': 'multipleChoice',
  'matching': 'matching',
  'map-pin': 'mapPin'
}

useSeoMeta({
  title: () => `${t(topic.titleKey)} · ${t('heritage.games.title')}`,
  description: () => t(topic.descriptionKey)
})
</script>

<template>
  <UContainer class="py-10 sm:py-14">
    <div class="mx-auto max-w-4xl">
      <UButton
        :to="localePath('/potkalnicko-prigorje')"
        :label="t('heritage.games.backToGames')"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="link"
        class="mb-6 px-0"
      />

      <header class="mb-8 space-y-3">
        <UIcon
          :name="topic.icon"
          class="size-10 text-primary"
        />
        <h1 class="text-4xl font-bold tracking-tight text-highlighted sm:text-5xl">
          {{ t(topic.titleKey) }}
        </h1>
        <p class="max-w-2xl text-lg text-muted">
          {{ t(topic.descriptionKey) }}
        </p>
      </header>

      <section
        aria-labelledby="topic-quiz-list-title"
        data-testid="topic-quiz-list"
      >
        <h2
          id="topic-quiz-list-title"
          class="mb-4 text-2xl font-semibold text-highlighted"
        >
          {{ t('heritage.games.quizListTitle', { topic: t(topic.titleKey) }) }}
        </h2>

        <p
          v-if="!quizzes.length"
          class="rounded-xl bg-elevated p-5 text-muted ring ring-default"
        >
          {{ t('heritage.games.emptyTopic') }}
        </p>

        <div
          v-else
          class="grid gap-4"
        >
          <UCard
            v-for="quiz in quizzes"
            :key="quiz.id"
            :data-testid="`quiz-row-${quiz.id}`"
          >
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0 space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-lg font-semibold text-highlighted">
                    {{ t(quiz.titleKey) }}
                  </h3>
                  <UBadge
                    :label="t(`heritage.games.mechanics.${mechanicTranslationKey[quiz.mechanic]}`)"
                    color="neutral"
                    variant="subtle"
                  />
                </div>
                <p class="text-muted">
                  {{ t(quiz.descriptionKey) }}
                </p>
              </div>
              <UButton
                v-if="quiz.playable && quiz.path"
                :to="localePath(quiz.path)"
                :label="t('heritage.games.play')"
                trailing-icon="i-lucide-arrow-right"
                class="shrink-0"
              />
              <UButton
                v-else
                :label="t('heritage.games.notPlayable')"
                disabled
                color="neutral"
                variant="outline"
                class="shrink-0"
              />
            </div>
          </UCard>
        </div>
      </section>
    </div>
  </UContainer>
</template>
