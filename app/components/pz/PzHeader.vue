<script setup lang="ts">
import { pzHeaderNavItems } from '~~/shared/utils/pzNav'
import { pzRoutes } from '~~/shared/utils/appRoutes'

const items = computed(() => [
  { label: 'Početna', to: pzRoutes.home },
  ...pzHeaderNavItems()
])
</script>

<template>
  <UHeader
    :to="pzRoutes.home"
    title="Potkalnički zapisi"
  >
    <template #title>
      <PzLogo />
    </template>
    <UNavigationMenu :items="items" />
    <template #right>
      <UColorModeButton />
    </template>
    <template #body>
      <UNavigationMenu
        :items="items"
        orientation="vertical"
        class="-mx-2.5"
      />
    </template>
  </UHeader>
</template>
