<script setup lang="ts">
import type { PublicPersonRef } from '~~/shared/types/publicAtlas'

// A linked list of persons (name, years, role) for place pages, item pages and the persons page.
defineProps<{
  persons: readonly (PublicPersonRef & { place?: string })[]
  testid?: string
}>()

const localePath = useLocalePath()
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]!.toLocaleUpperCase('hr')).join('')
</script>

<template>
  <ul
    class="divide-y divide-default rounded-lg ring ring-default"
    :data-testid="testid"
  >
    <li
      v-for="person in persons"
      :key="person.id"
    >
      <ULink
        :to="localePath(person.path)"
        class="flex items-center gap-3 px-4 py-3 text-sm hover:bg-elevated/40"
      >
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          aria-hidden="true"
        >{{ initials(person.name) }}</span>
        <span class="min-w-0">
          <span class="block font-medium text-highlighted">{{ person.name }}<span class="ml-2 font-normal text-muted tabular-nums">{{ person.years }}</span></span>
          <span
            v-if="person.role"
            class="block text-muted"
          >{{ person.role }}</span>
          <span
            v-if="person.place"
            class="block text-xs text-muted"
          >{{ person.place }}</span>
        </span>
      </ULink>
    </li>
  </ul>
</template>
