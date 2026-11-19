<script setup lang="ts">
// The frame of every admin page inside the dashboard layout: a navbar with the page title (the
// page's h1), page actions and the shell's tools (search, theme, account) on the right, and the body.
defineProps<{
  title: string
  description?: string
  icon?: string
  /** Narrow pages (forms, dashboards) can cap the width; lists use the full panel. */
  width?: 'full' | 'wide'
}>()
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar
        :title="title"
        :icon="icon"
        :toggle="false"
        :ui="{ root: 'border-default', title: 'font-display font-bold' }"
      >
        <template #right>
          <slot name="actions" />
          <AdminTopTools />
        </template>
      </UDashboardNavbar>
      <slot name="toolbar" />
    </template>
    <template #body>
      <div
        id="main-content"
        tabindex="-1"
        lang="hr"
        class="flex w-full flex-col gap-6 focus:outline-none"
        :class="{ 'mx-auto max-w-5xl': width === 'wide' }"
      >
        <p
          v-if="description"
          class="text-muted"
        >
          {{ description }}
        </p>
        <slot />
      </div>
    </template>
  </UDashboardPanel>
</template>
