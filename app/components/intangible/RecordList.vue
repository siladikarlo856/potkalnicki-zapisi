<script setup lang="ts">
import type { PublicIntangibleListItem } from '~~/shared/types/publicIntangible'

// A list of Stories, Customs and Folk texts as cards: title, where it was recorded, the start of the text, and its
// kind and type. Used by the Priče i običaji list, theme pages and narrator pages.
defineProps<{
  records: readonly PublicIntangibleListItem[]
  testid?: string
}>()

const localePath = useLocalePath()
const ICONS = { story: 'i-lucide-scroll-text', custom: 'i-lucide-calendar-days', folk_text: 'i-lucide-music' } as const
</script>

<template>
  <ul
    class="grid gap-3 lg:grid-cols-2"
    :data-testid="testid"
  >
    <li
      v-for="record in records"
      :key="record.id"
      class="flex"
    >
      <PzHeritageCard
        class="w-full"
        :title="record.title"
        :to="localePath(record.path)"
        :settlement="record.places.map(place => place.name).join(', ') || undefined"
        :description="record.excerpt ?? undefined"
        :category="`${record.kindLabel} · ${record.typeLabel}`"
        :icon="ICONS[record.kind]"
      />
    </li>
  </ul>
</template>
