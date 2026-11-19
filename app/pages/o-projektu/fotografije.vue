<script setup lang="ts">
import type { AtlasPhotoCreditsResponse } from '~~/shared/types/publicAtlas'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const { data } = await useAtlasFetch<AtlasPhotoCreditsResponse>('/api/atlas/photos')
const photos = computed(() => data.value?.photos ?? [])
const selectedAuthor = ref('all')
const shown = ref(20)

const authors = computed(() => [...new Set(photos.value.map(photo => photo.author))].sort((a, b) => a.localeCompare(b, 'hr')))
const filteredPhotos = computed(() => selectedAuthor.value === 'all' ? photos.value : photos.value.filter(photo => photo.author === selectedAuthor.value))
const visiblePhotos = computed(() => filteredPhotos.value.slice(0, shown.value))
const authorCount = computed(() => new Set(filteredPhotos.value.map(photo => photo.author)).size)
const countLabel = computed(() => `${filteredPhotos.value.length} fotografija · ${selectedAuthor.value === 'all' ? `${authorCount.value} autora` : selectedAuthor.value}`)
const authorItems = computed(() => [
  { label: `Svi autori${authors.value.length ? ` (${photos.value.length})` : ''}`, value: 'all' },
  ...authors.value.map(author => ({ label: `${author} (${photos.value.filter(photo => photo.author === author).length})`, value: author }))
])

watch(selectedAuthor, () => {
  shown.value = 20
})

useSeoMeta({
  title: () => 'Fotografije i autori · Potkalnički zapisi',
  ogTitle: () => 'Fotografije i autori · Potkalnički zapisi',
  description: () => 'Svaka fotografija u arhivu ima autora i uvjete pod kojima se smije koristiti.',
  ogDescription: () => 'Svaka fotografija u arhivu ima autora i uvjete pod kojima se smije koristiti.'
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-8 px-4 py-6 lg:px-12 lg:py-12">
    <PageHead
      title="Fotografije i autori"
      lead="Svaka fotografija u arhivu ima autora i uvjete pod kojima se smije koristiti. Ovdje su sve na jednom mjestu."
    >
      <template #before>
        <PzBackPill :to="localePath(pzRoutes.about)">
          {{ t('pz.about.title') }}
        </PzBackPill>
      </template>
    </PageHead>

    <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div class="flex flex-col gap-3 border-b border-default pb-4 sm:flex-row sm:items-center sm:justify-between">
        <p
          class="text-sm font-bold text-muted"
          role="status"
          data-testid="photo-count"
        >
          {{ countLabel }}
        </p>
        <USelect
          v-model="selectedAuthor"
          :items="authorItems"
          value-key="value"
          aria-label="Autor"
          class="w-full sm:w-auto sm:min-w-56"
        />
      </div>

      <div
        v-if="filteredPhotos.length"
        data-testid="photo-credits"
      >
        <ul class="divide-y divide-default">
          <li
            v-for="photo in visiblePhotos"
            :key="photo.url"
            class="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-4 py-4 sm:grid-cols-[6rem_minmax(0,1fr)]"
          >
            <img
              :src="photo.thumbUrl"
              :alt="photo.alt"
              :width="photo.width"
              :height="photo.height"
              loading="lazy"
              class="aspect-square h-auto w-24 rounded-(--pz-radius-md) bg-elevated object-cover"
            >
            <div class="min-w-0">
              <ULink
                v-if="photo.item.path"
                :to="localePath(photo.item.path)"
                class="font-bold text-highlighted underline-offset-2 hover:underline"
              >
                {{ photo.item.name }}
              </ULink>
              <p
                v-else
                class="font-bold text-highlighted"
              >
                {{ photo.item.name }}
              </p>
              <dl class="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                <dt class="text-muted">
                  Autor
                </dt>
                <dd>{{ photo.author }}</dd>
                <dt class="text-muted">
                  Licencija
                </dt>
                <dd>
                  <a
                    v-if="photo.licenseUrl"
                    :href="photo.licenseUrl"
                    target="_blank"
                    rel="license noopener"
                    class="underline underline-offset-2"
                  >{{ photo.licenseLabel }}</a>
                  <span v-else>{{ photo.licenseLabel }}</span>
                </dd>
                <dt class="text-muted">
                  Koristi se u
                </dt>
                <dd>
                  <ULink
                    v-if="photo.item.path"
                    :to="localePath(photo.item.path)"
                    class="underline underline-offset-2"
                  >{{ photo.item.name }}</ULink>
                  <span v-else>{{ photo.item.name }}</span>
                </dd>
              </dl>
              <PzPhotoCredit
                :image="photo"
                class="mt-2"
              />
            </div>
          </li>
        </ul>
        <PzLoadMore
          :shown="visiblePhotos.length"
          :total="filteredPhotos.length"
          :step="20"
          @load="shown += 20"
        />
      </div>

      <PageState
        v-else
        kind="empty"
        title="Još nema fotografija"
        description="Kad prve fotografije budu objavljene, ovdje će stajati njihovi autori i licencije."
      >
        <template #actions>
          <UButton
            :to="localePath({ path: pzRoutes.contribute, query: { vrsta: 'fotografija' } })"
            label="Pošalji fotografiju"
            icon="i-lucide-image-plus"
          />
        </template>
      </PageState>

      <PzCard
        title="Tvoja je fotografija krivo potpisana?"
        sub="Javi nam i ispravit ćemo potpis ili fotografiju ukloniti."
        variant="subtle"
      >
        <UButton
          :to="localePath(pzRoutes.contribute)"
          label="Prijavi pogrešan potpis"
          icon="i-lucide-pen-line"
          color="neutral"
          variant="outline"
        />
      </PzCard>
    </div>
  </div>
</template>
