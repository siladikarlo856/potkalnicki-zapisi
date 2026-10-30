<script setup lang="ts">
const props = defineProps<{ code: string }>()
const { t } = useI18n()
const localePath = useLocalePath()
const origin = ref('')
const copied = ref(false)
const error = ref('')
const nativeShare = ref(false)
const link = computed(() => origin.value + localePath(`/heritage/challenge/${props.code}`))

async function copy() {
  error.value = ''
  try {
    await navigator.clipboard.writeText(link.value)
    copied.value = true
  } catch {
    error.value = t('challenge.copyError')
  }
}

async function share() {
  error.value = ''
  try {
    await navigator.share({ title: t('challenge.title'), url: link.value })
  } catch (cause) {
    if (!(cause instanceof Error && cause.name === 'AbortError')) error.value = t('challenge.shareError')
  }
}

onMounted(() => {
  origin.value = window.location.origin
  nativeShare.value = typeof navigator.share === 'function'
})
</script>

<template>
  <UCard data-testid="challenge-share">
    <div class="space-y-4">
      <h2 class="text-xl font-semibold">
        {{ t('challenge.share') }}
      </h2>
      <p class="text-sm text-muted">
        {{ t('challenge.shareHelp') }}
      </p>
      <UFormField :label="t('challenge.link')">
        <UInput
          :model-value="link"
          readonly
          class="w-full"
          data-testid="challenge-share-link"
          @focus="($event.target as HTMLInputElement).select()"
        />
      </UFormField>
      <div class="flex flex-wrap gap-3">
        <UButton
          icon="i-lucide-copy"
          :disabled="!origin"
          data-testid="challenge-copy"
          @click="copy"
        >
          {{ t(copied ? 'challenge.copied' : 'challenge.copy') }}
        </UButton>
        <UButton
          v-if="nativeShare"
          color="neutral"
          variant="outline"
          icon="i-lucide-share-2"
          data-testid="challenge-native-share"
          @click="share"
        >
          {{ t('challenge.nativeShare') }}
        </UButton>
      </div>
      <p
        v-if="copied"
        role="status"
        class="sr-only"
      >
        {{ t('challenge.copied') }}
      </p>
      <p
        v-if="error"
        role="alert"
        class="text-sm text-error"
      >
        {{ error }}
      </p>
    </div>
  </UCard>
</template>
