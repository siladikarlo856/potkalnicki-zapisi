<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ nextAt: string }>()
const { t } = useI18n()

// Minute resolution on the device clock; not a live region, so it never announces itself.
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  now.value = Date.now()
  timer = setInterval(() => {
    now.value = Date.now()
  }, 60_000)
})
onBeforeUnmount(() => clearInterval(timer))

const minutes = computed(() => Math.max(0, Math.ceil((Date.parse(props.nextAt) - now.value) / 60_000)))
const hours = computed(() => Math.floor(minutes.value / 60))
const time = computed(() => hours.value
  ? t('daily.countdown.hoursMinutes', { h: hours.value, m: minutes.value % 60 })
  : t('daily.countdown.minutes', { m: minutes.value }))
</script>

<template>
  <p
    class="text-sm text-muted"
    data-testid="daily-countdown"
  >
    <time :datetime="`PT${hours}H${minutes % 60}M`">{{ t('daily.next', { time }) }}</time>
  </p>
</template>
