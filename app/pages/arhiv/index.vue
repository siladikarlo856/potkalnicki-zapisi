<script setup lang="ts">
import type { AtlasHeritageListResponse, AtlasOverviewResponse } from '~~/shared/types/publicAtlas'
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { data: overview } = await useAtlasFetch<AtlasOverviewResponse>('/api/atlas/overview')
const { data: heritage } = await useAtlasFetch<AtlasHeritageListResponse>('/api/atlas/heritage')
const localePath = useLocalePath()
const stats = computed(() => overview.value?.totals)
const sections = computed(() => [
  { name: 'Mjesta', icon: 'i-lucide-map-pin', to: pzRoutes.places, line: stats.value ? `${stats.value.settlements} naselja` : undefined },
  { name: 'Baština', icon: 'i-lucide-landmark', to: pzRoutes.heritage, line: stats.value ? `${stats.value.items} zapisa` : undefined },
  { name: 'Priče i običaji', icon: 'i-lucide-scroll-text', to: pzRoutes.intangible, line: 'Predaje, običaji i narodni tekstovi' },
  { name: 'Osobe', icon: 'i-lucide-users', to: pzRoutes.persons, line: 'Ljudi koji su obilježili kraj' },
  { name: 'Govor', icon: 'i-lucide-book-open', to: pzRoutes.speech, line: 'Riječi domaćega govora' }
])
const pending = computed(() => (heritage.value?.items ?? []).filter(item => item.verification === 'in_review').slice(0, 3))
function trust(status: string) {
  return status === 'verified' ? 'ok' : status === 'needs_update' ? 'warn' : 'pend' as const
}
</script>

<template>
  <main class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-8 px-4 py-6 lg:px-12 lg:py-12">
    <header class="flex max-w-(--pz-measure) flex-col gap-3">
      <h1 class="pz-display text-highlighted lg:pz-display-lg">
        Arhiv
      </h1>
      <p class="pz-lead text-muted">
        Sve što je dosad zapisano o Potkalničkom kraju: mjesta, građevine, priče, ljudi i riječi.
      </p>
      <div class="max-w-md lg:hidden">
        <PzSearchField @submit="q => navigateTo(localePath(`/trazi/${q ? `?q=${encodeURIComponent(q)}` : ''}`))" />
      </div>
    </header>
    <div class="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-12">
      <section
        class="flex flex-col gap-3 lg:col-span-7"
        aria-labelledby="archive-sections"
      >
        <h2
          id="archive-sections"
          class="sr-only"
        >
          Odjeljci arhiva
        </h2>
        <PzTile
          v-for="section in sections"
          :key="section.name"
          v-bind="section"
          variant="row"
        />
      </section>
      <aside class="flex flex-col gap-8 lg:col-span-5">
        <section
          class="flex flex-col gap-4"
          aria-labelledby="recent-title"
        >
          <h2
            id="recent-title"
            class="pz-h2 text-highlighted"
          >
            Nedavno provjereno
          </h2>
          <ul
            v-if="heritage?.items.length"
            class="flex flex-col divide-y divide-default rounded-lg border border-default bg-default px-4"
          >
            <li
              v-for="item in heritage.items.slice(0, 3)"
              :key="item.id"
              class="py-3"
            >
              <PzRecordCard
                :to="localePath(item.path ?? pzRoutes.heritage)"
                :title="item.name"
                :sub="item.settlement?.name ?? item.municipality.label"
                :kind="item.category.label"
                :verification="trust(item.verification)"
              />
            </li>
          </ul>
          <p
            v-else
            class="pz-body text-muted"
          >
            Trenutačno nedostupno.
          </p>
        </section>
        <section
          class="flex flex-col gap-4 rounded-lg border border-default bg-muted p-5"
          aria-labelledby="sources-title"
        >
          <h2
            id="sources-title"
            class="pz-h2 text-highlighted"
          >
            Traže se izvori
          </h2>
          <p class="pz-body text-muted">
            Ovi zapisi još su u provjeri. Znaš li knjigu, dokument ili kazivača koji ih potvrđuje, dodaj izvor.
          </p>
          <ul
            v-if="pending.length"
            class="flex flex-col gap-2"
          >
            <li
              v-for="item in pending"
              :key="item.id"
            >
              <NuxtLink
                :to="localePath(item.path ?? pzRoutes.heritage)"
                class="text-primary underline underline-offset-2"
              >{{ item.name }}</NuxtLink>
            </li>
          </ul>
          <NuxtLink
            :to="localePath(pzRoutes.heritage)"
            class="self-start text-primary underline underline-offset-2"
          >Dodaj izvor</NuxtLink>
        </section>
      </aside>
    </div>
  </main>
</template>
