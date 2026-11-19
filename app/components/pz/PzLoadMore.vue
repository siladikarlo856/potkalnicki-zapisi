<script setup lang="ts">
// "Prikaži još": results load on request, never on scroll, and the line says how many will come. States: more,
// busy (aria-busy, "Učitavam…"), end, failed (role="alert", retry). The consumer appends the items and moves
// focus to the first new one; `load` fires on the button and on "Pokušaj ponovno".
const props = withDefaults(defineProps<{
  shown: number
  total: number
  /** How many the next press adds. */
  step?: number
  state?: 'idle' | 'busy' | 'failed'
}>(), { step: 20, state: 'idle' })

const emit = defineEmits<{ load: [] }>()

const remaining = computed(() => Math.max(props.total - props.shown, 0))
const next = computed(() => Math.min(props.step, remaining.value))
const ended = computed(() => remaining.value === 0)
</script>

<template>
  <div
    class="mt-6 flex flex-col items-center gap-2 text-sm text-muted"
    :aria-busy="state === 'busy'"
    data-testid="load-more"
    :data-state="ended ? 'end' : state"
  >
    <p v-if="ended">
      Prikazano je svih {{ total }} {{ pluralFormHr(total) === 'one' ? 'zapis' : 'zapisa' }}.
    </p>
    <template v-else-if="state === 'failed'">
      <p role="alert">
        Nismo uspjeli učitati još zapisa.
      </p>
      <UButton
        color="neutral"
        variant="outline"
        @click="emit('load')"
      >
        Pokušaj ponovno
      </UButton>
    </template>
    <template v-else>
      <p>Prikazano {{ shown }} od {{ total }}</p>
      <UButton
        color="neutral"
        variant="outline"
        :loading="state === 'busy'"
        @click="emit('load')"
      >
        {{ state === 'busy' ? 'Učitavam…' : `Prikaži još ${next}` }}
      </UButton>
    </template>
  </div>
</template>
