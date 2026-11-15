<script setup lang="ts">
import {
  HERITAGE_STATUS_LABELS, HERITAGE_STATUSES, HERITAGE_VERIFICATION_LABELS, HERITAGE_VERIFICATIONS,
  validateHeritageItem, type HeritageItem, type HeritageItemValue
} from '~~/shared/utils/content/heritageItem'
import type { HeritageCategory } from '~~/shared/utils/content/category'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Baština', robots: 'noindex, nofollow' })

type ItemForm = HeritageItemValue

const localePath = useLocalePath()

const { data: categoriesData } = useFetch<{ rows: HeritageCategory[] }>('/api/admin/content/heritage_category', {
  query: { size: 100, sort: 'sort' },
  server: false
})
const categoryOptions = computed(() => (categoriesData.value?.rows ?? []).map(row => ({ label: row.labelHr, value: row.id })))

const verificationOptions = HERITAGE_VERIFICATIONS.map(value => ({ label: HERITAGE_VERIFICATION_LABELS[value], value }))
const heritageStatusOptions = [{ label: '—', value: '__none__' }, ...HERITAGE_STATUSES.map(value => ({ label: HERITAGE_STATUS_LABELS[value], value }))]

const resource = defineAdminResource<HeritageItem, ItemForm>({
  kind: 'heritage_item',
  icon: 'i-lucide-landmark',
  dialogWidth: 'wide',
  labels: {
    title: 'Baština',
    description: 'Crkve, kapele, križevi i drugi zapisi sakralne baštine Potkalničkog prigorja.',
    create: 'Novi zapis',
    edit: 'Uredi zapis baštine',
    empty: 'Još nema zapisa baštine.',
    search: 'Pretraži zapise'
  },
  columns: [
    { key: 'name', label: 'Naziv', sort: 'name' },
    { key: 'categoryLabel', label: 'Kategorija', hideBelow: 'sm' },
    { key: 'verification', label: 'Provjera', sort: 'verification', hideBelow: 'md' }
  ],
  filters: [
    { key: 'categoryId', label: 'Kategorija', options: [] },
    { key: 'verification', label: 'Status provjere', options: verificationOptions }
  ],
  defaultSort: 'name',
  blank: () => ({
    name: '', slug: '', categoryId: '', municipalityId: '', settlementId: null, locality: null,
    verification: 'unverified', heritageStatus: null, registryNumber: null, period: null, description: null,
    researchNotes: '', latitude: null, longitude: null, noindex: false, sourceIds: [], images: [], status: 'published'
  }),
  toForm: item => ({
    name: item.name,
    slug: item.slug,
    categoryId: item.categoryId,
    municipalityId: item.municipalityId,
    settlementId: item.settlementId,
    locality: item.locality,
    verification: item.verification,
    heritageStatus: item.heritageStatus ?? '__none__',
    registryNumber: item.registryNumber,
    period: item.period,
    description: item.description,
    researchNotes: item.researchNotes,
    latitude: item.latitude,
    longitude: item.longitude,
    noindex: item.noindex,
    sourceIds: item.sourceIds ?? [],
    images: item.images ?? [],
    status: item.status
  }),
  validate: form => validateHeritageItem({
    ...form,
    heritageStatus: form.heritageStatus === '__none__' ? null : form.heritageStatus
  }).issues,
  label: item => item.name,
  publicPath: item => item.settlementSlug ? localePath(`/bastina/${item.settlementSlug}/${item.slug}`) : undefined
})

watch(categoryOptions, (options) => {
  const categoryFilter = resource.filters?.find(entry => entry.key === 'categoryId')
  if (categoryFilter) categoryFilter.options = options
}, { immediate: true })
</script>

<template>
  <AdminResourcePage :resource="resource">
    <template #toolbar-after="{ state, setQuery }">
      <div
        v-if="categoryOptions.length"
        class="flex flex-wrap gap-2"
        data-testid="admin-bastina-category-chips"
      >
        <UButton
          size="sm"
          :color="state.filters.categoryId ? 'neutral' : 'primary'"
          :variant="state.filters.categoryId ? 'outline' : 'solid'"
          label="Sve kategorije"
          @click="setQuery({ filters: { ...state.filters, categoryId: undefined } })"
        />
        <UButton
          v-for="option in categoryOptions"
          :key="option.value"
          size="sm"
          :color="state.filters.categoryId === option.value ? 'primary' : 'neutral'"
          :variant="state.filters.categoryId === option.value ? 'solid' : 'outline'"
          :label="option.label"
          @click="setQuery({ filters: { ...state.filters, categoryId: option.value } })"
        />
      </div>
    </template>

    <template #categoryLabel-cell="{ row }">
      {{ row.categoryLabel ?? '—' }}
    </template>
    <template #verification-cell="{ row }">
      {{ HERITAGE_VERIFICATION_LABELS[row.verification] ?? row.verification }}
    </template>

    <template #fields="{ state: form, entity }">
      <AdminHeritageItemFields
        :state="form"
        :entity-id="entity?.id"
        :category-options="categoryOptions"
        :verification-options="verificationOptions"
        :heritage-status-options="heritageStatusOptions"
        @update:state="Object.assign(form, $event)"
      />
    </template>
  </AdminResourcePage>
</template>
