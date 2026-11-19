<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
// Pick: the first decision of a flow, where each option needs a sentence of explanation (difficulty of a game, the
// game of a challenge). A native radio group in a fieldset: arrows move, Space selects. Selected is a heavier ink
// border, a subtle fill and the radio mark, never colour alone.
export interface PickOption {
  value: string
  label: string
  description?: string
  icon?: string
  testid?: string
}

withDefaults(defineProps<{ legend: string, options: readonly PickOption[], name: string, columns?: 1 | 2, hideLegend?: boolean }>(), { columns: 1 })
const model = defineModel<string>()
</script>

<template>
  <fieldset
    class="m-0 min-w-0 border-0 p-0"
    data-testid="pick-group"
  >
    <legend
      class="mb-2 p-0 text-base font-bold text-highlighted"
      :class="{ 'sr-only': hideLegend }"
    >
      {{ legend }}
    </legend>
    <div
      class="grid gap-2"
      :class="columns === 2 ? 'sm:grid-cols-2' : ''"
    >
      <label
        v-for="option in options"
        :key="option.value"
        class="flex min-h-16 cursor-pointer items-center gap-3 rounded-(--pz-radius-md) border-[1.5px] border-accented bg-default px-4 py-2.5 hover:border-inverted has-checked:border-2 has-checked:border-inverted has-checked:bg-elevated has-checked:px-[15px] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--pz-focus)"
        :data-testid="option.testid"
      >
        <input
          v-model="model"
          type="radio"
          :name="name"
          :value="option.value"
          class="size-[22px] shrink-0 accent-(--ui-primary)"
        >
        <UIcon
          v-if="option.icon"
          :name="option.icon"
          class="size-6 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span class="min-w-0">
          <b class="block text-base text-highlighted">{{ option.label }}</b>
          <small
            v-if="option.description"
            class="block text-sm text-muted"
          >{{ option.description }}</small>
        </span>
      </label>
    </div>
  </fieldset>
</template>
