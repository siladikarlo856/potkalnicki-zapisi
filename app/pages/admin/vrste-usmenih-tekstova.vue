<script setup lang="ts">
import { validateFolkTextType } from '#shared/utils/content/intangibleList'
import type { KeyedListEntry } from '#shared/utils/content/intangibleList'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Vrste usmenih tekstova', robots: 'noindex, nofollow' })

interface ListForm {
  key: string
  labelHr: string
  labelEn: string
  sort: number
  status: KeyedListEntry['status']
}

const resource = defineAdminResource<KeyedListEntry, ListForm>({
  kind: 'folk_text_type',
  icon: 'i-lucide-tags',
  labels: {
    title: 'Vrste usmenih tekstova',
    description: 'Vrste usmenih tekstova (pjesma, molitva, poslovica, zagonetka…) koje se koriste u popisu i filterima.',
    create: 'Nova vrsta usmenog teksta',
    edit: 'Uredi vrstu usmenog teksta',
    empty: 'Još nema vrsta usmenih tekstova.',
    search: 'Pretraži vrste usmenih tekstova'
  },
  columns: [
    { key: 'labelHr', label: 'Naziv', sort: 'labelHr' },
    { key: 'key', label: 'Ključ', sort: 'key', hideBelow: 'md' },
    { key: 'sort', label: 'Redoslijed', sort: 'sort', hideBelow: 'lg' }
  ],
  defaultSort: 'sort',
  blank: () => ({ key: '', labelHr: '', labelEn: '', sort: 0, status: 'published' }),
  toForm: row => ({ key: row.key, labelHr: row.labelHr, labelEn: row.labelEn ?? '', sort: row.sort, status: row.status }),
  validate: form => validateFolkTextType({ ...form, labelEn: form.labelEn || null }).issues,
  label: row => row.labelHr
})
</script>

<template>
  <AdminResourcePage :resource="resource">
    <template #fields="{ state: form }">
      <AdminKeyedListFields
        :state="form"
        key-example="poslovica-izreka"
        @update:state="Object.assign(form, $event)"
      />
    </template>
  </AdminResourcePage>
</template>
