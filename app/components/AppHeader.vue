<script setup lang="ts">
import { pzSectionGroups, pzCurrentSection, pathMatches } from '~~/shared/utils/pzNav'

const route = useRoute()
const localePath = useLocalePath()
const search = ref('')
const searchInput = useTemplateRef<HTMLInputElement>('searchInput')
const active = computed(() => pzCurrentSection(route.path))

function submitSearch() {
  if (search.value.trim()) navigateTo(localePath({ path: '/trazi/', query: { q: search.value.trim() } }))
  else navigateTo(localePath('/trazi/'))
}

onMounted(() => {
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.target instanceof Element && event.target.matches('input, textarea, select, [contenteditable]')) return
    event.preventDefault()
    searchInput.value?.focus()
  }
  document.addEventListener('keydown', onKey)
  onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
})
</script>

<template>
  <header
    class="z-50 border-b border-default bg-default lg:sticky lg:top-0 print:static"
    data-testid="app-header"
  >
    <div class="border-b border-default/70">
      <UContainer class="flex min-h-14 items-center gap-3 py-1 md:min-h-16 lg:min-h-[68px]">
        <NuxtLink
          :to="localePath('/')"
          class="flex min-h-(--pz-tap-min) shrink-0 items-center gap-2 rounded-md"
          aria-label="Potkalnički zapisi, Početna"
        >
          <PzLogo />
          <span class="hidden font-display text-lg font-bold text-highlighted sm:inline">Potkalnički zapisi</span>
        </NuxtLink>
        <nav
          class="hidden items-center gap-1 md:flex lg:hidden"
          aria-label="Glavna navigacija"
        >
          <NuxtLink
            v-for="item in [{ label: 'Početna', to: '/' }, { label: 'Arhiv', to: '/arhiv/' }, { label: 'Igraj i uči', to: '/igraj/' }, { label: 'Doprinesi', to: '/doprinesi/' }]"
            :key="item.to"
            :to="localePath(item.to)"
            class="min-h-(--pz-tap-min) rounded-full px-3 py-2 text-sm font-semibold text-muted hover:bg-elevated"
            :class="{ 'bg-primary text-inverted': pathMatches(route.path, item.to) }"
          >{{ item.label }}</NuxtLink>
        </nav>
        <form
          class="ms-auto hidden min-w-0 flex-1 max-w-xl lg:flex"
          role="search"
          @submit.prevent="submitSearch"
        >
          <UInput
            ref="searchInput"
            v-model="search"
            icon="i-lucide-search"
            size="xl"
            class="w-full"
            placeholder="Traži mjesta, baštinu, osobe, priče, riječi"
            aria-label="Traži"
          />
        </form>
        <UButton
          class="md:hidden"
          color="neutral"
          variant="ghost"
          icon="i-lucide-search"
          aria-label="Traži"
          :to="localePath('/trazi/')"
        />
        <UColorModeButton
          color="neutral"
          variant="ghost"
          class="min-h-(--pz-tap-min)"
        />
        <UButton
          class="hidden lg:inline-flex"
          :to="localePath('/doprinesi/')"
          label="Doprinesi"
          color="neutral"
          variant="outline"
        />
      </UContainer>
    </div>
    <div class="hidden border-b border-default lg:block">
      <UContainer class="flex min-h-12 items-center gap-8 overflow-x-auto">
        <nav
          v-for="group in pzSectionGroups"
          :key="group.to"
          class="flex items-center gap-1 whitespace-nowrap"
          :aria-label="group.label"
        >
          <NuxtLink
            :to="localePath(group.to)"
            class="rounded-full px-2 py-1 text-xs font-bold uppercase tracking-wider text-muted hover:bg-elevated"
          >{{ group.label }}</NuxtLink>
          <NuxtLink
            v-for="item in group.items"
            :key="item.to"
            :to="localePath(item.to)"
            :aria-current="active === item.to ? 'page' : undefined"
            class="min-h-9 rounded-full px-3 py-1.5 text-sm font-semibold text-muted hover:bg-elevated aria-[current=page]:bg-primary aria-[current=page]:text-inverted"
          >{{ item.label }}</NuxtLink>
        </nav>
        <NuxtLink
          class="ms-auto whitespace-nowrap text-sm font-semibold text-muted hover:text-default xl:inline"
          :to="localePath('/o-projektu/')"
        >O projektu</NuxtLink>
      </UContainer>
    </div>
  </header>
</template>
