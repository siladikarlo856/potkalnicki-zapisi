<script setup lang="ts">
import type { PoolMunicipality, PoolPlace } from '~~/shared/utils/learn/types'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

useSeoMeta({ robots: 'noindex, nofollow' })

const route = useRoute()
const colorMode = useColorMode()
const theme = computed(() => route.query.theme === 'dark' ? 'dark' : 'light')
watch(theme, (value) => {
  colorMode.preference = value
}, { immediate: true })
useHead(() => ({
  htmlAttrs: { class: theme.value === 'dark' ? 'dark' : undefined },
  link: [{ rel: 'preload', as: 'image', href: '/potkalnicko-prigorje/karta/karta.webp' }]
}))

const municipalities: PoolMunicipality[] = [{
  id: 'kalnik',
  slug: 'kalnik',
  name: 'Općina Kalnik',
  label: 'Općina Kalnik',
  dative: 'Općini Kalnik',
  lat: 46.12059,
  lng: 16.46437
}]

const places: PoolPlace[] = [{
  kind: 'place',
  key: 'place:063835',
  id: '063835',
  topics: ['mjesta'],
  name: 'Šopron',
  slug: 'sopron',
  municipalityId: 'kalnik',
  lat: 46.12059,
  lng: 16.46437,
  itemCount: 0,
  seat: false,
  difficulty: 2
}]

const targetPoint = { lat: places[0]!.lat, lng: places[0]!.lng }
const options = [
  { hr: 'Kalnik', en: 'Kalnik' },
  { hr: 'Šopron', en: 'Šopron' },
  { hr: 'Apatovec', en: 'Apatovec' },
  { hr: 'Križevci', en: 'Križevci' }
]
</script>

<template>
  <UContainer class="max-w-3xl py-10">
    <UCard data-testid="challenge-question">
      <div class="space-y-5">
        <div class="text-sm text-primary">
          Krug 1 · Pitanje 1 od 5
        </div>
        <h2 class="text-xl leading-relaxed font-semibold">
          Koje je ovo selo?
        </h2>
        <GamesMapView
          :places="places"
          :municipalities="municipalities"
          difficulty="srednje"
          mode="target"
          layer-locked="karta"
          :target-point="targetPoint"
          data-testid="challenge-map"
        />
        <div
          class="grid gap-3"
          role="group"
          aria-label="Koje je ovo selo?"
        >
          <UButton
            v-for="(option, index) in options"
            :key="index"
            color="neutral"
            variant="outline"
            size="lg"
            class="justify-start whitespace-normal text-left"
          >
            <span class="shrink-0 font-bold">{{ String.fromCharCode(65 + index) }}.</span>
            {{ option.hr }}
          </UButton>
        </div>
      </div>
    </UCard>
  </UContainer>
</template>
