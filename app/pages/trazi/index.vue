<script setup lang="ts">
import type { ArchiveSearchResponse } from '~~/shared/types/publicAtlas'
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const submitted = ref(query.value.trim().length >= 2)
const { data, pending, error, refresh } = await useFetch<ArchiveSearchResponse>('/api/atlas/search', {
  query: computed(() => ({ q: query.value.trim() })),
  immediate: false,
  watch: false
})
if (submitted.value) await refresh()
const total = computed(() => data.value?.total ?? 0)
const groups = computed(() => data.value?.groups ?? [])

watch(() => route.query.q, (value) => {
  const next = typeof value === 'string' ? value : ''
  if (next === query.value) return
  query.value = next
  submitted.value = next.trim().length >= 2
  if (submitted.value) refresh()
})

function submit(value = query.value) {
  const next = value.trim()
  query.value = next
  submitted.value = next.length >= 2
  router.replace({ query: next ? { q: next } : {} })
  if (submitted.value) refresh()
}

function verification(status?: string): 'pend' | 'ok' | 'warn' {
  return status === 'verified' ? 'ok' : status === 'needs_update' ? 'warn' : 'pend'
}
</script>

<template>
  <main class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-8 px-4 py-6 lg:px-12 lg:py-12">
    <header class="flex max-w-(--pz-measure) flex-col gap-3">
      <h1 class="pz-display text-highlighted lg:pz-display-lg">
        Traži
      </h1>
      <PzSearchField
        v-model="query"
        @submit="submit"
      />
      <p class="pz-body-sm text-muted">
        Možeš pisati i bez kvačica: „skrlak” nalazi „škrlak”.
      </p>
    </header>

    <section
      v-if="!submitted"
      class="flex flex-col gap-4"
      aria-labelledby="browse-title"
    >
      <h2
        id="browse-title"
        class="pz-h2 text-highlighted"
      >
        Ili pregledaj po vrsti
      </h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <PzTile
          name="Mjesta"
          icon="i-lucide-map-pin"
          :to="localePath(pzRoutes.places)"
          variant="surface"
        />
        <PzTile
          name="Baština"
          icon="i-lucide-landmark"
          :to="localePath(pzRoutes.heritage)"
          variant="surface"
        />
        <PzTile
          name="Priče i običaji"
          icon="i-lucide-scroll-text"
          :to="localePath(pzRoutes.intangible)"
          variant="surface"
        />
        <PzTile
          name="Osobe"
          icon="i-lucide-users"
          :to="localePath(pzRoutes.persons)"
          variant="surface"
        />
        <PzTile
          name="Govor"
          icon="i-lucide-book-open"
          :to="localePath(pzRoutes.speech)"
          variant="surface"
        />
      </div>
    </section>

    <template v-else>
      <p
        v-if="pending"
        class="pz-body text-muted"
        role="status"
      >
        Tražimo „{{ query }}”…
      </p>
      <PzEmptyState
        v-else-if="error || !data"
        title="Pretraživanje trenutačno ne radi"
        description="Nije do tebe. Pokušaj ponovno za koji trenutak ili pregledaj arhiv po odjeljcima."
      />
      <UButton
        v-if="error || !data"
        label="Pokušaj ponovno"
        color="neutral"
        variant="outline"
        class="self-start"
        @click="() => refresh()"
      />
      <template v-else-if="total === 0">
        <PzEmptyState
          :title="`Nema rezultata za „${query}”`"
          description="Provjeri kako je napisano ili pokušaj s manje riječi. Moguće je i da to još nitko nije zapisao."
        />
        <div class="flex flex-wrap gap-3">
          <NuxtLink
            :to="localePath(pzRoutes.contribute)"
            class="text-primary underline underline-offset-2"
          >Pošalji zapis</NuxtLink>
          <NuxtLink
            :to="localePath(pzRoutes.archive)"
            class="text-primary underline underline-offset-2"
          >Pregledaj arhiv</NuxtLink>
        </div>
      </template>
      <div
        v-else
        class="flex flex-col gap-8"
      >
        <p
          class="pz-body-sm text-muted"
          role="status"
        >
          {{ total }} {{ total === 1 ? 'rezultat' : 'rezultata' }} za „{{ query }}”
        </p>
        <div class="grid gap-8 lg:grid-cols-2">
          <section
            v-for="group in groups"
            :key="group.key"
            class="flex flex-col gap-3"
            :aria-labelledby="`group-${group.key}`"
          >
            <div class="flex items-baseline justify-between gap-3">
              <h2
                :id="`group-${group.key}`"
                class="pz-h2 text-highlighted"
              >
                {{ group.label }}
              </h2><span class="pz-caption text-muted">{{ group.total }}</span>
            </div>
            <ul class="divide-y divide-default border-y border-default">
              <li
                v-for="hit in group.hits"
                :key="hit.id"
                class="py-3"
              >
                <template v-if="group.key === 'speech'">
                  <PzWordRow
                    :to="localePath(hit.path)"
                    :word="hit.title"
                    :meaning="hit.context"
                    :query="query"
                  />
                </template>
                <NuxtLink
                  v-else
                  :to="localePath(hit.path)"
                  class="group flex min-h-16 flex-col justify-center gap-1 text-default no-underline"
                >
                  <span class="font-display text-lg font-bold group-hover:underline">{{ hit.title }}</span>
                  <span class="text-sm text-muted">{{ hit.context }} · {{ hit.kind }}</span>
                  <PzVerificationStamp
                    v-if="hit.verification"
                    :state="verification(hit.verification)"
                  />
                </NuxtLink>
              </li>
            </ul>
            <NuxtLink
              v-if="group.total > group.hits.length"
              :to="localePath(pzRoutes.archive)"
              class="self-start text-primary underline underline-offset-2"
            >Svi rezultati</NuxtLink>
          </section>
        </div>
      </div>
    </template>
  </main>
</template>
