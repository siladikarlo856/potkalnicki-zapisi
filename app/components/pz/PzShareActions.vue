<script setup lang="ts">
// How a challenge or a result leaves the app: full-width rows for WhatsApp and Viber (local groups talk there),
// "Više mogućnosti" when the browser can share natively, and the read-only link with "Kopiraj". Used inside
// PzShareSheet and inline on the challenge share step. The consumer decides what is sent and what is copied.
const props = defineProps<{
  /** Prefix of the test ids: `<prefix>-whatsapp`, `-viber`, `-native-share`, `-copy` and `-share-link`. */
  prefix: string
  /** The prepared plain-text message WhatsApp and Viber carry. */
  message: string
  /** The short link shown in the field and put on the clipboard. */
  url: string
  /** What `navigator.share` receives. */
  shareData: { title: string, text?: string, url?: string }
  disabled?: boolean
}>()

const { t } = useI18n()
const copied = ref(false)
const error = ref('')
const nativeShare = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const whatsapp = computed(() => `https://wa.me/?text=${encodeURIComponent(props.message)}`)
const viber = computed(() => `viber://forward?text=${encodeURIComponent(props.message)}`)

async function copy() {
  error.value = ''
  try {
    await navigator.clipboard.writeText(props.url)
    copied.value = true
    clearTimeout(timer)
    // "Kopirano" shows for two seconds, then the button reads "Kopiraj" again.
    timer = setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    error.value = t('pz.share.copyError')
  }
}

async function share() {
  error.value = ''
  try {
    await navigator.share(props.shareData)
  } catch (cause) {
    if (!(cause instanceof Error && cause.name === 'AbortError')) error.value = t('pz.share.shareError')
  }
}

watch(() => props.url, () => {
  copied.value = false
})
onMounted(() => {
  nativeShare.value = typeof navigator.share === 'function'
})
onBeforeUnmount(() => clearTimeout(timer))

const row = 'grid min-h-14 w-full grid-cols-[40px_minmax(0,1fr)_20px] items-center gap-3 rounded-(--pz-radius-md) border border-accented bg-default px-3 py-2 text-start text-base font-semibold text-default no-underline transition-colors hover:bg-muted motion-reduce:transition-none'
const tile = 'grid size-10 place-items-center rounded-(--pz-radius-md) bg-accented text-default'
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-2"
    data-testid="pz-share-actions"
  >
    <a
      :href="whatsapp"
      target="_blank"
      rel="noopener"
      :class="row"
      :data-testid="`${prefix}-whatsapp`"
    >
      <span :class="tile"><UIcon
        name="i-simple-icons-whatsapp"
        class="size-5"
      /></span>
      <span>{{ t('pz.share.whatsapp') }}</span>
      <UIcon
        name="i-lucide-chevron-right"
        class="size-5 text-muted"
      />
    </a>
    <a
      :href="viber"
      :class="row"
      :data-testid="`${prefix}-viber`"
    >
      <span :class="tile"><UIcon
        name="i-simple-icons-viber"
        class="size-5"
      /></span>
      <span>{{ t('pz.share.viber') }}</span>
      <UIcon
        name="i-lucide-chevron-right"
        class="size-5 text-muted"
      />
    </a>
    <button
      v-if="nativeShare"
      type="button"
      :class="row"
      :data-testid="`${prefix}-native-share`"
      @click="share"
    >
      <span :class="tile"><UIcon
        name="i-lucide-share-2"
        class="size-5"
      /></span>
      <span>{{ t('pz.share.more') }}</span>
      <UIcon
        name="i-lucide-chevron-right"
        class="size-5 text-muted"
      />
    </button>

    <UFormField
      :label="t('pz.share.link')"
      class="mt-2"
    >
      <div class="flex gap-2">
        <UInput
          :model-value="url"
          readonly
          class="min-w-0 flex-1"
          :data-testid="`${prefix}-share-link`"
          @focus="($event.target as HTMLInputElement).select()"
        />
        <UButton
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
          color="neutral"
          variant="outline"
          :disabled="disabled || !url"
          :data-testid="`${prefix}-copy`"
          @click="copy"
        >
          {{ copied ? t('pz.share.copied') : t('pz.share.copy') }}
        </UButton>
      </div>
    </UFormField>
    <p
      role="status"
      aria-live="polite"
      class="sr-only"
    >
      <template v-if="copied">
        {{ t('pz.share.copied') }}
      </template>
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
