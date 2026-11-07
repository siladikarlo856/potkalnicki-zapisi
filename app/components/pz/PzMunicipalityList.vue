<script setup lang="ts">
// "Pet općina": one row per municipality with its counts. Each row is one link named by the municipality.
export interface PzMunicipalityRow {
  id: string
  label: string
  to: string
  settlements: number
  items: number
}

defineProps<{
  rows: PzMunicipalityRow[]
}>()

const { t } = useI18n()
</script>

<template>
  <ul
    class="divide-y divide-default overflow-hidden rounded-(--pz-radius-lg) border border-default bg-default"
    data-testid="municipality-list"
  >
    <li
      v-for="row in rows"
      :key="row.id"
    >
      <NuxtLink
        :to="row.to"
        class="flex min-h-(--pz-tap-min) items-center justify-between gap-3 px-4 py-3 text-default no-underline hover:bg-muted"
      >
        <span class="flex min-w-0 flex-col">
          <b class="pz-label wrap-anywhere text-highlighted">{{ row.label }}</b>
          <small class="pz-caption font-normal text-muted tabular-nums">
            {{ t('pz.home.scopeCounts', { settlements: row.settlements, items: row.items }) }}
          </small>
        </span>
        <UIcon
          name="i-lucide-chevron-right"
          class="size-5 shrink-0 text-dimmed"
          aria-hidden="true"
        />
      </NuxtLink>
    </li>
  </ul>
</template>
