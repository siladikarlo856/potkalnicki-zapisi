<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Pregled', robots: 'noindex, nofollow' })

const tiles = [
  { title: 'Prilozi', description: 'Pregledaj i odobri priloge zajednice.', icon: 'i-lucide-inbox', to: '/admin/prilozi' },
  { title: 'Riječi', description: 'Uredi skice i aktivne kartice.', icon: 'i-lucide-book-open', to: '/admin/rijeci' },
  { title: 'Riječ dana', description: 'Raspored, zaliha riječi i prikvačeni dani.', icon: 'i-lucide-calendar-days', to: '/admin/rijeci#rijec-dana' },
  { title: 'Baština: ispravci', description: 'Ispravci zapisa iz inventara.', icon: 'i-lucide-landmark', to: '/admin/bastina' },
  { title: 'Izvori', description: 'Registri, studije i radovi na koje se pozivaju zapisi.', icon: 'i-lucide-library', to: '/admin/izvori' },
  { title: 'Izazovi', description: 'Dolazi u sljedećoj fazi.', icon: 'i-lucide-trophy' }
]
</script>

<template>
  <AdminPanel
    title="Pregled"
    description="Upravljanje sadržajem na jednom mjestu."
    icon="i-lucide-layout-dashboard"
  >
    <UPageGrid>
      <UPageCard
        v-for="tile in tiles"
        :key="tile.title"
        :title="tile.title"
        :description="tile.description"
        :icon="tile.icon"
        :to="tile.to"
        :class="{ 'opacity-60': !tile.to }"
        variant="outline"
      />
    </UPageGrid>
  </AdminPanel>
</template>
