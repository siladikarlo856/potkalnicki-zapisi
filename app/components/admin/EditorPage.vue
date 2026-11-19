<script setup lang="ts">
// The editor as a page (Uređivanje zapisa): the way back to the table, the record's name and its actions, the form in a main
// column and a 320px side column (one column below 1024px: main groups, then side groups), and the save bar at the bottom.
// It takes the same slot names as the dialog it replaces (`body`, `footer`), plus `header-actions` and `side`.
defineProps<{
  title: string
  /** The resource, for the way back: "Baština". */
  backLabel: string
}>()
const emit = defineEmits<{ back: [] }>()
</script>

<template>
  <div
    class="flex flex-col gap-4"
    data-testid="admin-editor-page"
  >
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="backLabel"
        class="-ms-2.5"
        data-testid="admin-editor-back"
        @click="emit('back')"
      />
      <h2 class="pz-h2 min-w-0 flex-1 text-highlighted">
        {{ title }}
      </h2>
      <div class="flex flex-wrap items-center gap-2">
        <slot name="header-actions" />
      </div>
    </div>
    <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div class="min-w-0">
        <slot name="body" />
      </div>
      <aside
        class="flex flex-col gap-4"
        aria-label="Objava i povezano"
      >
        <slot name="side" />
      </aside>
    </div>
    <slot name="footer" />
  </div>
</template>
