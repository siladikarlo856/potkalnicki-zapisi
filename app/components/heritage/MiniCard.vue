<script setup lang="ts">
const { words, status, error, refresh } = useHeritage()
const { locale, t } = useI18n()
const localePath = useLocalePath()

const entry = computed(() => words.value[0])
const behindLeft = computed(() => words.value[1])
const behindRight = computed(() => words.value[2])
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
        :class="index === 0 ? '-translate-x-10 -rotate-8 justify-start sm:-translate-x-14 sm:-rotate-9' : 'translate-x-10 rotate-7 justify-end sm:translate-x-14 sm:rotate-8'"
      >
        <span class="text-lg font-bold text-dimmed">{{ behind?.headword }}</span>
      </div>
      <HeritageWordFlipCard
        v-model:flipped="flipped"
        :entry="entry"
        :english="locale === 'en'"
        compact
        class="relative"
      />
    </div>
    <div class="flex flex-wrap items-center justify-center gap-2 print:hidden">
      <UButton
        :label="flipped ? t('home.teaser.flipBack') : t('home.teaser.flip')"
        icon="i-lucide-rotate-3d"
        color="neutral"
        variant="subtle"
        size="sm"
        @click="flipped = !flipped"
      />
      <UButton
        :to="localePath('/potkalnicko-prigorje/uci')"
        :label="t('home.teaser.play')"
        trailing-icon="i-lucide-arrow-right"
        variant="link"
        size="sm"
      />
    </div>
  </div>
  <div
    v-else
    class="text-center text-sm text-muted"
    role="status"
  >
    <p>{{ error ? (locale === 'hr' ? 'Kartice trenutačno nisu dostupne.' : 'Cards are currently unavailable.') : (status === 'pending' || status === 'idle') ? (locale === 'hr' ? 'Učitavam kartice…' : 'Loading cards…') : (locale === 'hr' ? 'Nove kartice stižu uskoro.' : 'New cards coming soon.') }}</p>
    <UButton
      v-if="error"
      :label="locale === 'hr' ? 'Pokušaj opet' : 'Try again'"
      variant="link"
      @click="refresh()"
    />
  </div>
</template>
