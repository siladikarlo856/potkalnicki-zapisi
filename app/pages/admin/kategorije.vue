<script setup lang="ts">
import { CATEGORY_LIMITS, validateHeritageCategory } from '~~/shared/utils/content/category'
import type { HeritageCategory } from '~~/shared/utils/content/category'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Kategorije baštine', robots: 'noindex, nofollow' })

interface CategoryForm {
  key: string
  labelHr: string
  labelEn: string
  sort: number
  status: HeritageCategory['status']
}

const resource = defineAdminResource<HeritageCategory, CategoryForm>({
  kind: 'heritage_category',
  icon: 'i-lucide-tags',
  labels: {
    title: 'Kategorije baštine',
    description: 'Vrste zapisa (crkve, kapele, križevi…) koje se koriste u popisu baštine i filterima.',
    create: 'Nova kategorija',
    edit: 'Uredi kategoriju',
    empty: 'Još nema kategorija.',
    search: 'Pretraži kategorije'
  },
  columns: [
    { key: 'labelHr', label: 'Naziv', sort: 'labelHr' },
    { key: 'key', label: 'Ključ', sort: 'key', hideBelow: 'md' },
    { key: 'sort', label: 'Redoslijed', sort: 'sort', hideBelow: 'lg' }
  ],
  defaultSort: 'sort',
  blank: () => ({ key: '', labelHr: '', labelEn: '', sort: 0, status: 'published' }),
  toForm: row => ({ key: row.key, labelHr: row.labelHr, labelEn: row.labelEn ?? '', sort: row.sort, status: row.status }),
  validate: form => validateHeritageCategory({ ...form, labelEn: form.labelEn || null }).issues,
  label: row => row.labelHr
})
</script>

<template>
  <AdminResourcePage :resource="resource">
    <template #fields="{ state }">
      <UFormField
        name="labelHr"
        label="Naziv (hr)"
        required
      >
        <UInput
          v-model="state.labelHr"
          :maxlength="CATEGORY_LIMITS.labelHr"
          class="w-full"
          autofocus
        />
      </UFormField>
      <UFormField
        name="labelEn"
        label="Naziv (en)"
        hint="Neobavezno"
      >
        <UInput
          v-model="state.labelEn"
          :maxlength="CATEGORY_LIMITS.labelEn"
          class="w-full"
        />
      </UFormField>
      <UFormField
        name="key"
        label="Ključ"
        required
        description="Stabilni identifikator (mala slova i crtice), npr. wayside-shrine."
      >
        <UInput
          v-model="state.key"
          :maxlength="CATEGORY_LIMITS.key"
          class="w-full font-mono text-sm"
        />
      </UFormField>
      <UFormField
        name="sort"
        label="Redoslijed"
      >
        <UInput
          v-model.number="state.sort"
          type="number"
          class="w-full"
        />
      </UFormField>
    </template>
  </AdminResourcePage>
</template>
