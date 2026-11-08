<script setup lang="ts">
import { validateFolkText } from '#shared/utils/content/folkText'
import type { FolkText, FolkTextValue } from '#shared/utils/content/folkText'
import { INTANGIBLE_VERIFICATIONS, INTANGIBLE_VERIFICATION_LABELS } from '#shared/utils/content/intangible'
import { blankFolkText, folkTextToForm, formatRecordedOn } from '~/utils/intangibleForm'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Usmeni tekstovi', robots: 'noindex, nofollow' })

const typeOptions = useKeyedListOptions('folk_text_type')
const verificationOptions = INTANGIBLE_VERIFICATIONS.map(value => ({ label: INTANGIBLE_VERIFICATION_LABELS[value], value }))

// Reactive, so the type filter's options (loaded after the page) reach the list state that validates the URL.
const resource = reactive(defineAdminResource<FolkText, FolkTextValue>({
  kind: 'folk_text',
  icon: 'i-lucide-message-square-quote',
  dialogWidth: 'wide',
  labels: {
    title: 'Usmeni tekstovi',
    description: 'Pjesme, molitve, poslovice, zagonetke, brojalice, kletve i blagoslovi, zdravice: kratki tekstovi kojima je točan izričaj dio zapisa.',
    create: 'Novi usmeni tekst',
    edit: 'Uredi usmeni tekst',
    empty: 'Još nema usmenih tekstova.',
    search: 'Pretraži usmene tekstove'
  },
  columns: [
    { key: 'title', label: 'Naslov', sort: 'title' },
    { key: 'typeLabel', label: 'Vrsta', hideBelow: 'sm' },
    { key: 'customLabel', label: 'Običaj', hideBelow: 'md' },
    { key: 'placesLabel', label: 'Zabilježeno u', hideBelow: 'lg' },
    { key: 'recordedYear', label: 'Zabilježeno', sort: 'recordedYear', hideBelow: 'lg' },
    { key: 'verification', label: 'Potvrđenost', sort: 'verification', hideBelow: 'lg' }
  ],
  filters: [
    { key: 'typeId', label: 'Vrsta', options: [] },
    { key: 'verification', label: 'Potvrđenost', options: verificationOptions }
  ],
  defaultSort: 'title',
  blank: blankFolkText,
  toForm: folkTextToForm,
  validate: form => validateFolkText(form).issues,
  label: folkText => folkText.title
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
    <template #verification-cell="{ row }">
      {{ INTANGIBLE_VERIFICATION_LABELS[row.verification] ?? row.verification }}
    </template>

    <template #fields="{ state: form, entity }">
      <AdminIntangibleFields
        kind="folk_text"
        :state="form"
        :entity-id="entity?.id"
        :type-options="typeOptions"
        @update:state="Object.assign(form, $event)"
      />
    </template>
  </AdminResourcePage>
</template>
