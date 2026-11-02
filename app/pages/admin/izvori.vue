<script setup lang="ts">
import { SOURCE_LIMITS, SOURCE_TYPES, SOURCE_TYPE_LABELS, validateSource } from '~~/shared/utils/content/source'
import type { Source, SourceType } from '~~/shared/utils/content/source'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Izvori', robots: 'noindex, nofollow' })

interface SourceForm {
  title: string
  type: SourceType | undefined
  url: string
  note: string
}

// Bound rather than written as an attribute: vue-tsc misreads a literal "https://" inside a scoped slot.
const URL_PLACEHOLDER = 'https://'
const typeOptions = SOURCE_TYPES.map(value => ({ label: SOURCE_TYPE_LABELS[value], value }))

const resource = defineAdminResource<Source, SourceForm>({
  kind: 'source',
  icon: 'i-lucide-library',
  labels: {
    title: 'Izvori',
    description: 'Registri, studije, rječnici i drugi radovi na koje se pozivaju zapisi baštine.',
    create: 'Novi izvor',
    edit: 'Uredi izvor',
    empty: 'Još nema izvora.',
    search: 'Pretraži izvore'
  },
  columns: [
    { key: 'title', label: 'Naslov', sort: 'title' },
    { key: 'type', label: 'Vrsta', sort: 'type', hideBelow: 'sm' },
    { key: 'url', label: 'Poveznica', hideBelow: 'lg' }
  ],
  filters: [{ key: 'type', label: 'Vrsta', options: typeOptions }],
  defaultSort: 'title',
  blank: () => ({ title: '', type: undefined, url: '', note: '' }),
  toForm: source => ({ title: source.title, type: source.type, url: source.url ?? '', note: source.note ?? '' }),
  validate: form => validateSource(form).issues,
  label: source => source.title
})
</script>

<template>
  <AdminResourcePage :resource="resource">
    <template #type-cell="{ row }">
      {{ SOURCE_TYPE_LABELS[row.type] ?? row.type }}
    </template>
    <template #url-cell="{ row }">
      <ULink
        v-if="row.url"
        :to="row.url"
        target="_blank"
        rel="noopener noreferrer"
        class="block max-w-xs truncate text-primary"
        @click.stop
      >
        {{ row.url }}
      </ULink>
      <span
        v-else
        class="text-dimmed"
      >—</span>
    </template>

    <template #fields="{ state }">
      <UFormField
        name="title"
        label="Naslov"
        required
      >
        <UInput
          v-model="state.title"
          :maxlength="SOURCE_LIMITS.title"
          class="w-full"
          autofocus
        />
      </UFormField>
      <UFormField
        name="type"
        label="Vrsta"
        required
      >
        <USelect
          v-model="state.type"
          :items="typeOptions"
          placeholder="Odaberi vrstu"
          class="w-full"
        />
      </UFormField>
      <UFormField
        name="url"
        label="Poveznica"
        hint="Neobavezno"
      >
        <UInput
          v-model="state.url"
          type="url"
          inputmode="url"
          :placeholder="URL_PLACEHOLDER"
          :maxlength="SOURCE_LIMITS.url"
          class="w-full"
        />
      </UFormField>
      <UFormField
        name="note"
        label="Napomena"
        hint="Neobavezno"
        description="Bibliografski podaci, signatura ili kratko objašnjenje izvora."
      >
        <UTextarea
          v-model="state.note"
          :maxlength="SOURCE_LIMITS.note"
          :rows="3"
          autoresize
          class="w-full"
        />
      </UFormField>
    </template>
  </AdminResourcePage>
</template>
