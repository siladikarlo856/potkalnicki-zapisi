<script setup lang="ts">
const localePath = useLocalePath()
const heading = useTemplateRef<HTMLElement>('heading')
const props = withDefaults(defineProps<{
  kind?: 'not-found' | 'removed' | 'moved' | 'offline' | 'unavailable' | 'error' | 'empty'
  title?: string
  description?: string
  icon?: string
}>(), { kind: 'error' })
const emit = defineEmits<{ retry: [] }>()

const copy = {
  'not-found': ['Ove stranice nema', 'Adresa je možda krivo prepisana ili poveznica više ne vrijedi. Potraži ono što te zanima ili kreni od arhiva.', 'i-lucide-map-pin-off'],
  'removed': ['Ovaj je zapis uklonjen', 'Ovaj zapis više nije dostupan.', 'i-lucide-archive-x'],
  'moved': ['Ovaj zapis ima novu adresu', 'Stara poveznica više ne vrijedi. Otvori zapis na novoj adresi.', 'i-lucide-corner-up-right'],
  'offline': ['Nema veze', 'Ova stranica još nije bila otvorena na ovom uređaju, pa je ne možemo prikazati bez veze. Stranice koje su već bile otvorene i dalje se mogu čitati, a učenje riječi radi i bez veze.', 'i-lucide-wifi-off'],
  'unavailable': ['Arhiv je nakratko nedostupan', 'Upravo ga uređujemo. Trebao bi opet raditi za nekoliko minuta. Ništa od onoga što je spremljeno na tvom uređaju nije izgubljeno.', 'i-lucide-construction'],
  'error': ['Nešto je pošlo po krivu', 'Nije do tebe. Pokušaj ponovno. Ako se ponovi, javi nam što se dogodilo i na kojoj stranici.', 'i-lucide-cloud-alert'],
  'empty': ['Nema zapisa za ove filtre', 'Očisti filtre ili pokušaj s drugim odabirom.', 'i-lucide-circle-alert']
} as const

const text = computed(() => [props.title ?? copy[props.kind][0], props.description ?? copy[props.kind][1]])
const iconName = computed(() => props.icon ?? copy[props.kind][2])

onMounted(() => nextTick(() => heading.value?.focus()))
</script>

<template>
  <section
    class="mx-auto flex max-w-[480px] flex-col items-center gap-4 py-16 text-center"
    tabindex="-1"
    data-testid="page-state"
  >
    <span class="grid size-[72px] place-items-center rounded-full bg-elevated text-muted">
      <UIcon
        :name="iconName"
        class="size-8"
        aria-hidden="true"
      />
    </span>
    <h1
      ref="heading"
      tabindex="-1"
      class="pz-h1 text-highlighted outline-none"
    >
      {{ text[0] }}
    </h1>
    <p class="text-toned">
      {{ text[1] }}
    </p>
    <div class="flex flex-wrap justify-center gap-3">
      <slot name="actions">
        <UButton
          v-if="kind === 'not-found' || kind === 'empty'"
          :to="localePath(pzRoutes.places)"
          label="Otvori arhiv"
        />
        <UButton
          v-else
          label="Pokušaj ponovno"
          icon="i-lucide-refresh-cw"
          @click="emit('retry')"
        />
      </slot>
    </div>
  </section>
</template>
