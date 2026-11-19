<script setup lang="ts">
// The facts about a record in a fixed place: right after the photographs on phone, beside them on desktop.
// A <section> labelled "Podaci" with a definition list. A missing value reads "Nije upisano" and the row stays.
// Values that are places or themes are links (`to`). At most six facts; never the verification stamp.
// The protection plaque (heritage only) is always last: pass its props as `protection`.

export interface PzFact {
  label: string
  value?: string | null
  to?: string
}

withDefaults(defineProps<{
  facts: PzFact[]
  title?: string
  protection?: { status: 'z' | 'p' | 'u', number?: string, href?: string }
}>(), { title: 'Podaci' })
</script>

<template>
  <PzCard
    :title="title"
    data-testid="facts-panel"
  >
    <template
      v-if="$slots.locator"
      #media
    >
      <slot name="locator" />
    </template>
    <dl class="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-1">
      <div
        v-for="fact in facts"
        :key="fact.label"
        class="flex min-w-0 flex-col"
        data-testid="fact"
      >
        <dt class="text-sm text-muted">
          {{ fact.label }}
        </dt>
        <dd class="font-bold">
          <NuxtLink
            v-if="fact.value && fact.to"
            :to="fact.to"
            class="underline underline-offset-[3px]"
          >
            {{ fact.value }}
          </NuxtLink>
          <template v-else-if="fact.value">
            {{ fact.value }}
          </template>
          <span
            v-else
            class="font-normal text-muted"
          >Nije upisano</span>
        </dd>
      </div>
    </dl>
    <PzProtectionPlaque
      v-if="protection"
      v-bind="protection"
      block
      class="mt-4"
    />
  </PzCard>
</template>
