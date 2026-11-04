<script setup lang="ts">
import { pzRoutes } from '~~/shared/utils/appRoutes'
import { municipalityFor } from '~~/shared/utils/games/distractors'
import type { PoolPlace } from '~~/shared/utils/learn/types'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const { pool, status, error, refresh } = useCardPool()

const sheetOpen = ref(false)
const picked = ref<PoolPlace | null>(null)

const places = computed(() => pool.value.cards.filter((c): c is PoolPlace => c.kind === 'place'))
const municipalities = computed(() => pool.value.municipalities)
const loading = computed(() => !error.value && (status.value === 'idle' || status.value === 'pending'))

function onPick(payload: { placeId?: string }) {
  if (!payload.placeId) return
  const place = places.value.find(p => p.id === payload.placeId)
  if (!place) return
  picked.value = place
  sheetOpen.value = true
}

const unitTopic = computed(() => {
  if (!picked.value) return 'mjesta'
  const unit = municipalityFor(pool.value, picked.value.municipalityId)
  return unit ? `mjesta-${unit.slug}` : 'mjesta'
})

useSeoMeta({
  title: () => t('pz.map.learnTitle'),
  description: () => t('pz.map.learnBlurb')
})
</script>

<template>
  <UContainer class="py-3 sm:py-5 lg:py-6">
    <div class="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-3">
      <header>
        <p class="mb-1 text-xs font-semibold text-primary">
          {{ t('pz.map.learnTitle') }}
        </p>
        <h1 class="text-2xl font-bold tracking-tight text-highlighted sm:text-3xl">
          {{ t('pz.map.learnTitle') }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ t('pz.map.learnBlurb') }}
        </p>
      </header>

      <div
        v-if="error || loading"
        class="rounded-xl bg-default p-4 ring ring-default"
        role="status"
      >
        <p>{{ t(error ? 'quiz.loadError' : 'quiz.loading') }}</p>
        <UButton
          v-if="error"
          :label="t('quiz.retry')"
          variant="link"
          @click="refresh()"
        />
      </div>

      <GamesMapView
        v-else
        :places="places"
        :municipalities="municipalities"
        difficulty="lako"
        mode="learn"
        data-testid="map-learn-view"
        @pick="onPick"
      />

      <USlideover
        v-model:open="sheetOpen"
        :title="picked?.name ?? ''"
      >
        <template #body>
          <template v-if="picked">
            <p class="text-sm text-muted">
              {{ municipalityFor(pool, picked.municipalityId)?.label }}
            </p>
            <UButton
              block
              class="mt-3"
              :to="localePath(`${pzRoutes.home}/naselja/${picked.slug}`)"
              :label="t('pz.map.openSettlement')"
              trailing-icon="i-lucide-arrow-right"
            />
            <UButton
              block
              class="mt-2"
              variant="outline"
              :to="localePath(`${pzRoutes.learn}/sesija?teme=${unitTopic}`)"
              :label="t('pz.map.learnUnitSettlements')"
            />
          </template>
        </template>
      </USlideover>
    </div>
  </UContainer>
</template>
