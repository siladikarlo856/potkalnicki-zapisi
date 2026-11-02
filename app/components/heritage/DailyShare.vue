<script setup lang="ts">
import { dailyWordShareText } from '~~/shared/utils/dailyWord'
import type { DailyProgress } from '~~/shared/utils/dailyWord'

// Spoiler-free: the text holds only the number, tries and squares, never the word or a clue.
const props = defineProps<{ number: number, result: Pick<DailyProgress, 'done' | 'solved' | 'tries' | 'maxTries'> }>()
const { t } = useI18n()
const text = computed(() => dailyWordShareText(props.number, props.result))
const labels = computed(() => ({
  copy: t('daily.share.copy'),
  copied: t('daily.share.copied'),
  nativeShare: t('daily.share.nativeShare'),
  copyError: t('daily.share.copyError'),
  shareError: t('daily.share.shareError'),
  whatsapp: t('challenge.whatsapp'),
  viber: t('challenge.viber')
}))
</script>

<template>
  <section
    v-if="text"
    class="flex min-w-0 flex-col gap-2 print:hidden"
    aria-labelledby="daily-share-title"
    data-testid="daily-share"
  >
    <h3
      id="daily-share-title"
      class="text-sm font-semibold text-highlighted"
    >
      {{ t('daily.share.title') }}
    </h3>
    <p
      lang="hr"
      class="rounded-lg bg-elevated p-2 text-sm wrap-anywhere whitespace-pre-line"
      data-testid="daily-share-text"
    >
      {{ text }}
    </p>
    <HeritageShareButtons
      prefix="daily"
      :copy-text="text"
      :share-data="{ title: t('daily.share.shareTitle'), text }"
      :message-text="text"
      :labels="labels"
    />
  </section>
</template>
