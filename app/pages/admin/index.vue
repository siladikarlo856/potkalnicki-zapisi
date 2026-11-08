<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Pregled', robots: 'noindex, nofollow' })

const tiles = [
  { title: 'Prijedlozi', description: 'Ispravci i prijedlozi novih zapisa od zajednice.', icon: 'i-lucide-inbox', to: '/admin/prijedlozi' },
  { title: 'Riječi', description: 'Uredi skice i aktivne kartice.', icon: 'i-lucide-book-open', to: '/admin/rijeci' },
  { title: 'Riječ dana', description: 'Raspored, zaliha riječi i prikvačeni dani.', icon: 'i-lucide-calendar-days', to: '/admin/rijec-dana' },
  { title: 'Baština', description: 'Crkve, kapele, križevi i drugi zapisi sakralne baštine.', icon: 'i-lucide-landmark', to: '/admin/bastina' },
  { title: 'Osobe', description: 'Povijesne osobe — kartice, izvori i veze na mjesta i baštinu.', icon: 'i-lucide-user-round', to: '/admin/osobe' },
  { title: 'Priče', description: 'Predaje, legende, bajke i životne priče kraja.', icon: 'i-lucide-scroll-text', to: '/admin/price' },
  { title: 'Običaji', description: 'Kako su stare generacije činile: godišnji i životni običaji.', icon: 'i-lucide-hand-heart', to: '/admin/obicaji' },
  { title: 'Usmeni tekstovi', description: 'Pjesme, molitve, poslovice, zagonetke i brojalice.', icon: 'i-lucide-message-square-quote', to: '/admin/usmeni-tekstovi' },
  { title: 'Kazivači', description: 'Tko je ispričao i zapisao, uz pristanak za javno navođenje imena.', icon: 'i-lucide-mic', to: '/admin/kazivaci' },
  { title: 'Izvori', description: 'Registri, studije i radovi na koje se pozivaju zapisi.', icon: 'i-lucide-library', to: '/admin/izvori' },
  { title: 'Izazovi', description: 'Skupovi pitanja za izazove prijatelja i trenutni izazov.', icon: 'i-lucide-trophy', to: '/admin/izazovi' },
  { title: 'Povijest', description: 'Tko je i kada mijenjao sadržaj; vrati raniju verziju.', icon: 'i-lucide-history', to: '/admin/povijest' }
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
