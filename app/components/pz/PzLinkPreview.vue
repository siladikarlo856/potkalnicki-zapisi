<script setup lang="ts">
// How a shared link looks in WhatsApp and Viber, drawn in the page: the deep sage card with the ridge, the brand line
// and the title, then the link text under it. The real image is public/og.svg (1200×630, fixed
// colours because the viewer's theme is unknown); this is its in-page stand-in on the challenge share step.
defineProps<{
  /** "Ivek te izaziva: Tko bolje zna naš kraj?" */
  title: string
  /** The line under the card: the page title, then the host. */
  caption: string
  host?: string
}>()
const { t } = useI18n()
</script>

<template>
  <div
    class="max-w-80 self-end rounded-(--pz-radius-lg) rounded-bl-sm bg-accented p-1.5"
    data-testid="pz-link-preview"
  >
    <div
      class="relative flex aspect-[1200/630] flex-col gap-2 overflow-hidden rounded-(--pz-radius-md) bg-[#374b40] p-[6%] text-white"
    >
      <PzRidge class="absolute inset-x-0 bottom-0 h-[38%] w-full text-[#b5ccbd]" />
      <span class="relative font-serif text-[11px]/none font-semibold text-[#fadfb0]">{{ t('pz.share.brand') }}</span>
      <span class="relative max-w-[80%] font-serif text-xl/[1.05] font-bold">{{ title }}</span>
    </div>
    <p class="px-1.5 pt-2 pb-1 text-[13px]/[18px] text-muted">
      <b class="block font-semibold text-default">{{ caption }}</b>
      <template v-if="host">
        {{ host }}
      </template>
    </p>
  </div>
</template>
