<script setup lang="ts">
const { words } = useHeritage()
const { locale, t } = useI18n()
const localePath = useLocalePath()

const entry = words[0]
const [behindLeft, behindRight] = words.slice(1, 3)
const flipped = ref(false)
</script>

<template>
  <div
    v-if="entry"
    class="flex flex-col items-center gap-8"
  >
    <div class="relative w-full max-w-60">
      <div
        v-for="(behind, index) in [behindLeft, behindRight]"
        :key="behind?.id ?? index"
        aria-hidden="true"
        class="absolute inset-0 flex scale-95 items-start rounded-xl bg-default p-3 shadow-sm ring ring-default"
        :class="index === 0 ? '-translate-x-14 -rotate-9 justify-start' : 'translate-x-14 rotate-8 justify-end'"
      >
        <span class="text-lg font-bold text-dimmed">{{ behind?.headword }}</span>
      </div>
      <HeritageWordFlipCard
        v-model:flipped="flipped"
        :entry="entry"
        :gloss="locale === 'en' ? entry.meaning.en : undefined"
        compact
        class="relative"
      />
    </div>
    <div class="flex flex-wrap items-center justify-center gap-2">
      <UButton
        :label="flipped ? t('home.teaser.flipBack') : t('home.teaser.flip')"
        icon="i-lucide-rotate-3d"
        color="neutral"
        variant="subtle"
        size="sm"
        @click="flipped = !flipped"
      />
      <UButton
        :to="localePath('/heritage/kartice')"
        :label="t('home.teaser.play')"
        trailing-icon="i-lucide-arrow-right"
        variant="link"
        size="sm"
      />
    </div>
  </div>
</template>
