<script setup lang="ts">
// "Izvori": an ordered list, one source per item (author or body, title, year, page or address). A narrator's
// testimony is a source. Never hidden behind a toggle; when empty it says so and offers "Dodaj izvor" (`addTo`).
withDefaults(defineProps<{
  sources: string[]
  /** Where "Dodaj izvor" leads. Without it the empty state shows the sentence only. */
  addTo?: string
  heading?: string
}>(), { heading: 'Izvori' })
</script>

<template>
  <section
    class="min-w-0"
    data-testid="source-list"
  >
    <h2 class="pz-h2 mb-2">
      {{ heading }}
    </h2>
    <ol
      v-if="sources.length"
      class="m-0 list-none p-0 text-[0.9375rem]/normal [counter-reset:pz-src]"
    >
      <li
        v-for="(source, i) in sources"
        :key="i"
        class="my-2 grid grid-cols-[1.75rem_minmax(0,1fr)] [counter-increment:pz-src] before:text-muted before:tabular-nums before:content-[counter(pz-src)'.']"
      >
        <span>{{ source }}</span>
      </li>
    </ol>
    <p
      v-else
      class="text-muted"
    >
      Za ovaj zapis još nema navedenih izvora.
      <NuxtLink
        v-if="addTo"
        :to="addTo"
        class="font-bold text-default underline underline-offset-[3px]"
      >
        Dodaj izvor
      </NuxtLink>
    </p>
  </section>
</template>
