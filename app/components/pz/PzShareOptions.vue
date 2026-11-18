<script setup lang="ts">
// The content of the share sheet: WhatsApp, Viber, "Kopiraj poveznicu" (or "Kopiraj tekst"), and "Više mogućnosti"
// where the Web Share API exists. For results (`message`) it first shows exactly the text that will be sent, with
// coloured squares allowed only there. Copy success emits `copied` (the consumer shows the toast and closes the
// sheet); copy failure keeps the sheet open, explains, and shows the text in a read-only field, already selected.
// Lucide has no brand icons, so both apps use the neutral send icon and are named in text.
const props = defineProps<{
  /** The address that is shared and copied. */
  url: string
  /** Record: "[Naslov], [naselje] · Potkalnički zapisi". Result: the game line, the squares, "Možeš li bolje?". */
  text: string
  /** Show the text that will be sent, for results. Copies the text and the address instead of the address alone. */
  preview?: boolean
}>()

const emit = defineEmits<{ copied: [] }>()

const copyFailed = ref(false)
const canShare = ref(false)
const fallback = useTemplateRef<HTMLTextAreaElement>('fallback')

const payload = computed(() => `${props.text}\n${props.url}`)
const copyValue = computed(() => props.preview ? payload.value : props.url)
const copyLabel = computed(() => props.preview ? 'Kopiraj tekst' : 'Kopiraj poveznicu')
const whatsapp = computed(() => `https://wa.me/?text=${encodeURIComponent(payload.value)}`)
const viber = computed(() => `viber://forward?text=${encodeURIComponent(payload.value)}`)

onMounted(() => {
  canShare.value = typeof navigator.share === 'function'
})

async function copy() {
  copyFailed.value = false
  try {
    await navigator.clipboard.writeText(copyValue.value)
    emit('copied')
  } catch {
    copyFailed.value = true
    await nextTick()
    fallback.value?.focus()
    fallback.value?.select()
  }
}

async function share() {
  try {
    await navigator.share({ text: props.text, url: props.url })
  } catch {
    // Dismissing the system sheet rejects; nothing to report.
  }
}
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-3"
    data-testid="share-options"
  >
    <div v-if="preview">
      <p class="mb-1 text-sm font-bold">
        Ovo će se poslati:
      </p>
      <pre
        class="m-0 rounded-md border border-default bg-elevated p-3 font-sans text-sm/normal wrap-anywhere whitespace-pre-wrap"
        lang="hr"
        data-testid="share-preview"
      >{{ payload }}</pre>
    </div>
    <div class="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:[&>*]:flex-1">
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-send"
        :href="whatsapp"
        target="_blank"
        rel="noopener"
        data-testid="share-whatsapp"
      >
        WhatsApp
      </UButton>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-send"
        :href="viber"
        data-testid="share-viber"
      >
        Viber
      </UButton>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-link"
        data-testid="share-copy"
        @click="copy"
      >
        {{ copyLabel }}
      </UButton>
    </div>
    <UButton
      v-if="canShare"
      color="neutral"
      variant="ghost"
      icon="i-lucide-share-2"
      data-testid="share-native"
      @click="share"
    >
      Više mogućnosti
    </UButton>
    <div
      v-if="copyFailed"
      class="flex flex-col gap-2"
      data-testid="share-copy-failed"
    >
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Kopiranje nije uspjelo"
        description="Preglednik nije dopustio kopiranje. Označi poveznicu u polju i kopiraj je ručno."
        role="alert"
      />
      <textarea
        ref="fallback"
        readonly
        rows="3"
        class="w-full rounded-md border-[1.5px] border-accented bg-default p-3 text-sm"
        aria-label="Poveznica za ručno kopiranje"
        :value="copyValue"
        @focus="($event.target as HTMLTextAreaElement).select()"
      />
    </div>
  </div>
</template>
