<script setup lang="ts">
import type { AtlasPhotoCreditsResponse } from '~~/shared/types/publicAtlas'

// "Zasluge za fotografije": every photo on the atlas with its author, licence and source, so the credit each
// free licence asks for is in one place as well as under the photo itself.
definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const { data } = await useAtlasFetch<AtlasPhotoCreditsResponse>('/api/atlas/photos')
const photos = computed(() => data.value?.photos ?? [])

useSeoMeta({
  title: () => `${t('pz.photos.creditsTitle')} · Potkalnički zapisi`,
  ogTitle: () => `${t('pz.photos.creditsTitle')} · Potkalnički zapisi`,
  description: () => t('pz.photos.creditsIntro'),
  ogDescription: () => t('pz.photos.creditsIntro')
})
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <article
      class="mx-auto flex max-w-3xl flex-col gap-8"
      data-testid="photo-credits-page"
    >
      <header>
        <PzBackPill :to="localePath('/potkalnicko-prigorje/o-projektu')">
          {{ t('pz.about.title') }}
        </PzBackPill>
        <h1 class="mt-4 text-3xl font-bold tracking-tight text-highlighted sm:text-4xl">
          {{ t('pz.photos.creditsTitle') }}
        </h1>
        <p class="mt-4 text-muted">
          {{ t('pz.photos.creditsIntro') }}
        </p>
      </header>

      <ul
        v-if="photos.length"
        class="flex flex-col divide-y divide-default"
        data-testid="photo-credits"
      >
        <li
          v-for="photo in photos"
          :key="photo.url"
          class="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 py-4"
        >
          <img
            :src="photo.thumbUrl"
            :alt="photo.alt"
            :width="photo.width"
            :height="photo.height"
            loading="lazy"
            class="aspect-4/3 h-auto w-24 rounded-(--pz-radius-md) bg-elevated object-cover"
          >
          <div class="flex min-w-0 flex-col gap-1">
            <ULink
              v-if="photo.item.path"
              :to="localePath(photo.item.path)"
              class="font-medium text-highlighted underline underline-offset-2"
            >
              {{ photo.item.name }}
            </ULink>
            <p
              v-else
              class="font-medium text-highlighted"
            >
              {{ photo.item.name }}
            </p>
            <PzPhotoCredit :image="photo" />
          </div>
        </li>
      </ul>
      <p
        v-else
        class="text-muted"
      >
        {{ t('pz.photos.creditsEmpty') }}
      </p>
    </article>
  </UContainer>
</template>
