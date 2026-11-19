<script setup lang="ts">
import { INTANGIBLE_VERIFICATIONS, INTANGIBLE_VERIFICATION_LABELS } from '#shared/utils/content/intangible'
import { validateStory } from '#shared/utils/content/story'
import type { Story, StoryValue } from '#shared/utils/content/story'
import { blankStory, formatRecordedOn, storyToForm } from '~/utils/intangibleForm'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Priče', robots: 'noindex, nofollow' })

const typeOptions = useKeyedListOptions('story_type')
const verificationOptions = INTANGIBLE_VERIFICATIONS.map(value => ({ label: INTANGIBLE_VERIFICATION_LABELS[value], value }))

// Reactive, so the type filter's options (loaded after the page) reach the list state that validates the URL.
const resource = reactive(defineAdminResource<Story, StoryValue>({
  kind: 'story',
  icon: 'i-lucide-scroll-text',
  editor: 'page',
  dialogWidth: 'wide',
  labels: {
    title: 'Priče',
    description: 'Što se u kraju pričalo: predaje, legende, bajke, šaljive i životne priče, u mjesnom govoru i u prepričanom obliku.',
    create: 'Nova priča',
    edit: 'Uredi priču',
    empty: 'Još nema priča.',
    search: 'Pretraži priče'
  },
  columns: [
    { key: 'title', label: 'Naslov', sort: 'title' },
    { key: 'typeLabel', label: 'Vrsta', hideBelow: 'sm' },
    { key: 'placesLabel', label: 'Zabilježeno u', hideBelow: 'md' },
    { key: 'recordedYear', label: 'Zabilježeno', sort: 'recordedYear', hideBelow: 'lg' },
    { key: 'verification', label: 'Potvrđenost', sort: 'verification', hideBelow: 'lg' }
  ],
  filters: [
    { key: 'typeId', label: 'Vrsta', options: [] },
    { key: 'verification', label: 'Potvrđenost', options: verificationOptions }
  ],
  defaultSort: 'title',
  blank: blankStory,
  toForm: storyToForm,
  validate: form => validateStory(form).issues,
  label: story => story.title
}))

watch(typeOptions, (options) => {
  const filter = resource.filters?.find(entry => entry.key === 'typeId')
  if (filter) filter.options = options
}, { immediate: true })
</script>

<template>
  <AdminResourcePage :resource="resource">
    <template #recordedYear-cell="{ row }">
      {{ formatRecordedOn(row) || '—' }}
    </template>

    <template #fields="{ state: form, entity }">
      <AdminIntangibleFields
        kind="story"
        :state="form"
        :entity-id="entity?.id"
        :type-options="typeOptions"
        @update:state="Object.assign(form, $event)"
      />
    </template>
  </AdminResourcePage>
</template>
