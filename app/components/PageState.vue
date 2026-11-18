<script setup lang="ts">
const props = withDefaults(defineProps<{ kind?: 'not-found' | 'removed' | 'moved' | 'offline' | 'error' | 'empty', title?: string, description?: string }>(), { kind: 'error' })
defineEmits<{ retry: [] }>()
const copy = { 'not-found': ['Ove stranice nema', 'Adresa je možda krivo prepisana ili poveznica više ne vrijedi.'], 'removed': ['Ovaj je zapis uklonjen', 'Ovaj zapis više nije dostupan.'], 'moved': ['Ovaj zapis ima novu adresu', 'Otvori zapis na novoj adresi.'], 'offline': ['Nema veze', 'Prikazujemo ono što je već učitano.'], 'error': ['Nešto je pošlo po krivu', 'Nije do tebe. Pokušaj ponovno.'], 'empty': ['Nema zapisa za ove filtre', 'Očisti filtre ili pokušaj s drugim odabirom.'] } as const
const text = computed(() => [props.title ?? copy[props.kind][0], props.description ?? copy[props.kind][1]])
</script>

<template>
  <section
    class="mx-auto flex max-w-[480px] flex-col items-center gap-4 py-16 text-center"
    tabindex="-1"
    data-testid="page-state"
  >
    <span class="grid size-[72px] place-items-center rounded-full bg-elevated text-muted"><UIcon
      :name="kind === 'not-found' ? 'i-lucide-map-pin-off' : kind === 'offline' ? 'i-lucide-wifi-off' : 'i-lucide-circle-alert'"
      class="size-8"
      aria-hidden="true"
    /></span>
    <h1 class="pz-h1 text-highlighted">
      {{ text[0] }}
    </h1><p class="text-toned">
      {{ text[1] }}
    </p>
    <div class="flex flex-wrap justify-center gap-3">
      <slot name="actions">
        <UButton
          v-if="kind === 'not-found' || kind === 'empty'"
          to="/arhiv/"
          label="Otvori arhiv"
        /><UButton
          v-else
          label="Pokušaj ponovno"
          @click="$emit('retry')"
        />
      </slot>
    </div>
  </section>
</template>
