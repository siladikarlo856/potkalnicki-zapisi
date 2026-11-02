<script setup lang="ts">
import { quizTopics } from '~/data/heritageQuizzes'

const { t } = useI18n()
const localePath = useLocalePath()
const topicCards = quizTopics.filter(topic => topic.slug !== 'rijeci')
</script>

<template>
  <div>
    <UPageSection
      :title="t('heritage.games.title')"
      :description="t('heritage.games.description')"
      :ui="{ root: 'border-t border-default' }"
      data-testid="quiz-catalog"
    >
      <UCard
        class="mb-6 overflow-hidden"
        data-testid="friend-challenge-hero"
        variant="soft"
      >
        <div class="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div class="space-y-3">
            <UBadge
              :label="t('challenge.friendTitle')"
              icon="i-lucide-swords"
              variant="subtle"
            />
            <div class="space-y-2">
              <h2 class="text-3xl font-bold text-highlighted sm:text-4xl">
                {{ t('pz.games.friendHeroTitle') }}
              </h2>
              <p class="max-w-2xl text-muted">
                {{ t('pz.games.friendHeroDescription') }}
              </p>
            </div>
          </div>
          <UButton
            :to="localePath('/potkalnicko-prigorje/izazov')"
            :label="t('pz.games.friendHeroCta')"
            trailing-icon="i-lucide-arrow-right"
            size="xl"
          />
        </div>
      </UCard>

      <UCard
        class="mb-6 overflow-hidden"
        data-testid="quiz-hero"
        variant="outline"
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
              <HeritageDailyStatus />
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
  </div>
</template>
