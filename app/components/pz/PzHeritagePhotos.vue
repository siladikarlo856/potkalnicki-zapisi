<script setup lang="ts">
import type { PublicImage } from '~~/shared/types/publicAtlas'

// An item's photos on its page: the main one large, the others as a row of smaller ones. Each opens the large
// file and carries its own credit.
const props = defineProps<{ images: PublicImage[] }>()

const { t } = useI18n()
const main = computed(() => props.images[0])
const rest = computed(() => props.images.slice(1))
</script>

<template>
  <section
    v-if="main"
    class="flex flex-col gap-4"
    :aria-label="t('pz.photos.title')"
    data-testid="heritage-photos"
  >
    <figure class="flex flex-col gap-2">
      <a
        :href="main.url"
        target="_blank"
        rel="noopener"
        :aria-label="t('pz.photos.open', { alt: main.alt })"
      >
        <img
          :src="main.url"
          :alt="main.alt"
          :width="main.width"
          :height="main.height"
          fetchpriority="high"
          class="h-auto max-h-[70vh] w-full rounded-(--pz-radius-lg) bg-elevated object-cover"
        >
      </a>
      <figcaption>
        <PzPhotoCredit :image="main" />
      </figcaption>
    </figure>
    <ul
      v-if="rest.length"
      class="grid grid-cols-2 gap-4 sm:grid-cols-3"
    >
      <li
        v-for="image in rest"
        :key="image.url"
      >
        <figure class="flex flex-col gap-2">
          <a
            :href="image.url"
            target="_blank"
            rel="noopener"
            :aria-label="t('pz.photos.open', { alt: image.alt })"
          >
            <img
              :src="image.thumbUrl"
              :alt="image.alt"
              :width="image.width"
              :height="image.height"
              loading="lazy"
              class="aspect-4/3 h-auto w-full rounded-(--pz-radius-md) bg-elevated object-cover"
            >
          </a>
          <figcaption>
            <PzPhotoCredit :image="image" />
          </figcaption>
        </figure>
      </li>
    </ul>
  </section>
</template>
