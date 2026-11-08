<script setup lang="ts">
import { validateOccasion } from '#shared/utils/content/intangibleList'
import type { KeyedListEntry } from '#shared/utils/content/intangibleList'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Prigode', robots: 'noindex, nofollow' })

interface ListForm {
  key: string
  labelHr: string
  labelEn: string
  sort: number
  status: KeyedListEntry['status']
}

const resource = defineAdminResource<KeyedListEntry, ListForm>({
  kind: 'occasion',
  icon: 'i-lucide-calendar-heart',
  labels: {
    title: 'Prigode',
    description: 'Dani, blagdani i životni događaji (Martinje, Božić, vjenčanje…) kojima pripadaju običaji.',
    create: 'Nova prigoda',
    edit: 'Uredi prigodu',
    empty: 'Još nema prigoda.',
    search: 'Pretraži prigode'
  },
  columns: [
    { key: 'labelHr', label: 'Naziv', sort: 'labelHr' },
    { key: 'key', label: 'Ključ', sort: 'key', hideBelow: 'md' },
    { key: 'sort', label: 'Redoslijed', sort: 'sort', hideBelow: 'lg' }
  ],
  defaultSort: 'sort',
  blank: () => ({ key: '', labelHr: '', labelEn: '', sort: 0, status: 'published' }),
  toForm: row => ({ key: row.key, labelHr: row.labelHr, labelEn: row.labelEn ?? '', sort: row.sort, status: row.status }),
  validate: form => validateOccasion({ ...form, labelEn: form.labelEn || null }).issues,
  label: row => row.labelHr
})
</script>

<template>
  <AdminResourcePage :resource="resource">
    <template #fields="{ state: form }">
      <AdminKeyedListFields
        :state="form"
        key-example="martinje"
        @update:state="Object.assign(form, $event)"
      />
    </template>
  </AdminResourcePage>
</template>
