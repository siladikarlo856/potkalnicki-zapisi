<script setup lang="ts">
import { validateCustom } from '#shared/utils/content/custom'
import type { Custom, CustomValue } from '#shared/utils/content/custom'
import { INTANGIBLE_VERIFICATIONS, INTANGIBLE_VERIFICATION_LABELS } from '#shared/utils/content/intangible'
import { blankCustom, customToForm, formatRecordedOn } from '~/utils/intangibleForm'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Običaji', robots: 'noindex, nofollow' })

const typeOptions = useKeyedListOptions('custom_type')
const verificationOptions = INTANGIBLE_VERIFICATIONS.map(value => ({ label: INTANGIBLE_VERIFICATION_LABELS[value], value }))

// Reactive, so the type filter's options (loaded after the page) reach the list state that validates the URL.
const resource = reactive(defineAdminResource<Custom, CustomValue>({
  kind: 'custom',
  icon: 'i-lucide-hand-heart',
  dialogWidth: 'wide',
  labels: {
    title: 'Običaji',
    description: 'Kako su stare generacije činile: godišnji i životni običaji, rad i svakodnevica, vjera i pobožnost, društveni život.',
    create: 'Novi običaj',
    edit: 'Uredi običaj',
    empty: 'Još nema običaja.',
    search: 'Pretraži običaje'
  },
  columns: [
    { key: 'title', label: 'Naslov', sort: 'title' },
    { key: 'typeLabel', label: 'Vrsta', hideBelow: 'sm' },
    { key: 'occasionLabel', label: 'Prigoda', hideBelow: 'md' },
    { key: 'placesLabel', label: 'Zabilježeno u', hideBelow: 'lg' },
    { key: 'recordedYear', label: 'Zabilježeno', sort: 'recordedYear', hideBelow: 'lg' },
    { key: 'verification', label: 'Potvrđenost', sort: 'verification', hideBelow: 'lg' }
  ],
  filters: [
    { key: 'typeId', label: 'Vrsta', options: [] },
    { key: 'verification', label: 'Potvrđenost', options: verificationOptions }
  ],
  defaultSort: 'title',
  blank: blankCustom,
  toForm: customToForm,
  validate: form => validateCustom(form).issues,
  label: custom => custom.title
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
        kind="custom"
        :state="form"
        :entity-id="entity?.id"
        :type-options="typeOptions"
        @update:state="Object.assign(form, $event)"
      />
    </template>
  </AdminResourcePage>
</template>
