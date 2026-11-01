<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Nadzorna ploča', robots: 'noindex, nofollow' })

const tiles = [
  { title: 'Prilozi', description: 'Pregledaj i odobri priloge zajednice.', icon: 'i-lucide-inbox', to: '/admin/prilozi' },
  { title: 'Riječi', description: 'Uredi skice i aktivne kartice.', icon: 'i-lucide-book-open', to: '/admin/rijeci' },
  { title: 'Riječ dana', description: 'Dolazi u sljedećoj fazi.', icon: 'i-lucide-calendar-days' },
  { title: 'Baština', description: 'Dolazi u sljedećoj fazi.', icon: 'i-lucide-landmark' },
  { title: 'Izazovi', description: 'Dolazi u sljedećoj fazi.', icon: 'i-lucide-trophy' }
]
</script>

<template>
  <UContainer class="py-10 sm:py-14">
    <div class="mb-8">
      <h1 class="text-4xl font-bold tracking-tight text-highlighted">
        Nadzorna ploča
      </h1>
      <p class="mt-3 text-lg text-muted">
        Upravljanje sadržajem na jednom mjestu.
      </p>
    </div>
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
  </UContainer>
</template>
