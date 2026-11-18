<script setup lang="ts">
import type { PublicIntangibleRef } from '~~/shared/types/publicIntangible'

// "Priče i običaji" on a place or person page: each record as a link with its kind and type under the title.
defineProps<{
  records: readonly PublicIntangibleRef[]
  testid?: string
}>()

const localePath = useLocalePath()
const categoryLabel = (record: PublicIntangibleRef) => record.kind === 'folk_text'
  ? record.typeLabel
  : `${record.kindLabel} · ${record.typeLabel}`
</script>

<template>
  <ul
    class="divide-y divide-default rounded-lg ring ring-default"
    :data-testid="testid"
  >
    <li
      v-for="record in records"
      :key="record.id"
    >
      <ULink
        :to="localePath(record.path)"
        class="flex min-h-(--pz-tap-min) flex-col justify-center px-4 py-3 text-sm hover:bg-elevated/40"
      >
        <span class="font-medium wrap-anywhere text-highlighted">{{ record.title }}</span>
        <span class="text-muted">{{ categoryLabel(record) }}</span>
      </ULink>
    </li>
  </ul>
</template>
