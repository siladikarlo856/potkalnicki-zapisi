<script setup lang="ts">
import { pzRoutes } from '~~/shared/utils/appRoutes'

const items = [
  { label: 'Početna', to: pzRoutes.home },
  { label: 'Igre', to: `${pzRoutes.home}#igre` },
  { label: 'Doprinesi', to: `${pzRoutes.home}#doprinos` }
]
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
