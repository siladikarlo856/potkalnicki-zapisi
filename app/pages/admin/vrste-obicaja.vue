<script setup lang="ts">
import { validateCustomType } from '#shared/utils/content/intangibleList'
import type { KeyedListEntry } from '#shared/utils/content/intangibleList'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Vrste običaja', robots: 'noindex, nofollow' })

interface ListForm {
  key: string
  labelHr: string
  labelEn: string
  sort: number
  status: KeyedListEntry['status']
}

const resource = defineAdminResource<KeyedListEntry, ListForm>({
  kind: 'custom_type',
  icon: 'i-lucide-tags',
  labels: {
    title: 'Vrste običaja',
    description: 'Vrste običaja (godišnji, životni, rad i svakodnevica…) koje se koriste u popisu običaja i filterima.',
    create: 'Nova vrsta običaja',
    edit: 'Uredi vrstu običaja',
    empty: 'Još nema vrsta običaja.',
    search: 'Pretraži vrste običaja'
  },
  columns: [
    { key: 'labelHr', label: 'Naziv', sort: 'labelHr' },
    { key: 'key', label: 'Ključ', sort: 'key', hideBelow: 'md' },
    { key: 'sort', label: 'Redoslijed', sort: 'sort', hideBelow: 'lg' }
  ],
  defaultSort: 'sort',
  blank: () => ({ key: '', labelHr: '', labelEn: '', sort: 0, status: 'published' }),
  toForm: row => ({ key: row.key, labelHr: row.labelHr, labelEn: row.labelEn ?? '', sort: row.sort, status: row.status }),
  validate: form => validateCustomType({ ...form, labelEn: form.labelEn || null }).issues,
  label: row => row.labelHr
})
</script>

<template>
  <AdminResourcePage :resource="resource">
    <template #fields="{ state: form }">
      <AdminKeyedListFields
        :state="form"
        key-example="godisnji-obicaji"
        @update:state="Object.assign(form, $event)"
      />
    </template>
  </AdminResourcePage>
</template>
