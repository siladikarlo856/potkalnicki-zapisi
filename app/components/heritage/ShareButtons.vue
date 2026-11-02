<script setup lang="ts">
// The copy, native share, WhatsApp and Viber actions shared by every heritage share panel.
// Parents decide what is copied and sent; this only runs the actions and reports failures.
interface ShareLabels {
  copy: string
  copied: string
  nativeShare: string
  copyError: string
  shareError: string
  whatsapp?: string
  viber?: string
}

const props = defineProps<{
  /** Prefix of the test ids: `<prefix>-copy`, `-native-share`, `-whatsapp` and `-viber`. */
  prefix: string
  copyText: string
  shareData: { title: string, text?: string, url?: string }
  /** When set, WhatsApp and Viber links carry this message. */
  messageText?: string
  labels: ShareLabels
  disabled?: boolean
  /** Which action is the solid, primary button. */
  emphasis?: 'copy' | 'share'
  centered?: boolean
}>()

const copied = ref(false)
const error = ref('')
const nativeShare = ref(false)
const whatsapp = computed(() => props.messageText === undefined ? '' : `https://wa.me/?text=${encodeURIComponent(props.messageText)}`)
const viber = computed(() => props.messageText === undefined ? '' : `viber://forward?text=${encodeURIComponent(props.messageText)}`)

async function copy() {
  error.value = ''
  try {
    await navigator.clipboard.writeText(props.copyText)
    copied.value = true
  } catch {
    error.value = props.labels.copyError
  }
}

async function share() {
  error.value = ''
  try {
    await navigator.share(props.shareData)
  } catch (cause) {
    if (!(cause instanceof Error && cause.name === 'AbortError')) error.value = props.labels.shareError
  }
}

watch(() => props.copyText, () => {
  copied.value = false
})
onMounted(() => {
  nativeShare.value = typeof navigator.share === 'function'
})
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2">
    <div :class="['flex flex-wrap gap-2', { 'justify-center': centered }]">
      <UButton
        icon="i-lucide-copy"
        :color="emphasis === 'share' ? 'neutral' : 'primary'"
        :variant="emphasis === 'share' ? 'outline' : 'solid'"
        :disabled="disabled"
        :data-testid="`${prefix}-copy`"
        @click="copy"
      >
        {{ copied ? labels.copied : labels.copy }}
      </UButton>
      <UButton
        v-if="nativeShare"
        icon="i-lucide-share-2"
        :color="emphasis === 'share' ? 'primary' : 'neutral'"
        :variant="emphasis === 'share' ? 'solid' : 'outline'"
        :data-testid="`${prefix}-native-share`"
        @click="share"
      >
        {{ labels.nativeShare }}
      </UButton>
      <UButton
        v-if="whatsapp"
        :to="whatsapp"
        target="_blank"
        external
        color="neutral"
        variant="outline"
        icon="i-simple-icons-whatsapp"
        :data-testid="`${prefix}-whatsapp`"
      >
        {{ labels.whatsapp }}
      </UButton>
      <UButton
        v-if="viber"
        :to="viber"
        external
        color="neutral"
        variant="outline"
        icon="i-simple-icons-viber"
        :data-testid="`${prefix}-viber`"
      >
        {{ labels.viber }}
      </UButton>
    </div>
    <p
      v-if="copied"
      role="status"
      class="sr-only"
    >
      {{ labels.copied }}
    </p>
    <p
      v-if="error"
      role="alert"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
  </div>
</template>
