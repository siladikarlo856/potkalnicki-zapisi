<script setup lang="ts">
import type { PublicImage } from '~~/shared/types/publicAtlas'

// The credit a reused photo needs, in one line: optional caption, author (linked when known), licence (linked to
// its deed) and the source page. Every place that shows a full photo shows this under it.
defineProps<{ image: PublicImage }>()

const { t } = useI18n()
</script>

<template>
  <p
    class="pz-caption font-normal text-muted"
    data-testid="pz-photo-credit"
  >
    <span v-if="image.caption">{{ image.caption }} · </span>
    <span>{{ t('pz.photos.by') }} </span>
    <a
      v-if="image.authorUrl"
      :href="image.authorUrl"
      target="_blank"
      rel="noopener"
      class="underline underline-offset-2"
    >{{ image.author }}</a>
    <span v-else>{{ image.author }}</span>
    <span>, </span>
    <a
      v-if="image.licenseUrl"
      :href="image.licenseUrl"
      target="_blank"
      rel="license noopener"
      class="underline underline-offset-2"
    >{{ image.licenseLabel }}</a>
    <span v-else>{{ image.licenseLabel }}</span>
    <template v-if="image.sourceUrl">
      <span> · </span>
      <a
        :href="image.sourceUrl"
        target="_blank"
        rel="noopener"
        class="underline underline-offset-2"
      >{{ t('pz.photos.source') }}</a>
    </template>
  </p>
</template>
