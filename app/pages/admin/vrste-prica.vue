<script setup lang="ts">
import { validateStoryType } from '#shared/utils/content/intangibleList'
import type { KeyedListEntry } from '#shared/utils/content/intangibleList'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Vrste priča', robots: 'noindex, nofollow' })

interface ListForm {
  key: string
  labelHr: string
  labelEn: string
  sort: number
  status: KeyedListEntry['status']
}

const resource = defineAdminResource<KeyedListEntry, ListForm>({
  kind: 'story_type',
  icon: 'i-lucide-tags',
  labels: {
    title: 'Vrste priča',
    description: 'Vrste priča (legenda, bajka, šaljiva priča…) koje se koriste u popisu priča i filterima.',
    create: 'Nova vrsta priče',
    edit: 'Uredi vrstu priče',
    empty: 'Još nema vrsta priča.',
    search: 'Pretraži vrste priča'
  },
  columns: [
    { key: 'labelHr', label: 'Naziv', sort: 'labelHr' },
    { key: 'key', label: 'Ključ', sort: 'key', hideBelow: 'md' },
    { key: 'sort', label: 'Redoslijed', sort: 'sort', hideBelow: 'lg' }
  ],
  defaultSort: 'sort',
  blank: () => ({ key: '', labelHr: '', labelEn: '', sort: 0, status: 'published' }),
  toForm: row => ({ key: row.key, labelHr: row.labelHr, labelEn: row.labelEn ?? '', sort: row.sort, status: row.status }),
  validate: form => validateStoryType({ ...form, labelEn: form.labelEn || null }).issues,
  label: row => row.labelHr
})
</script>

<template>
  <AdminResourcePage :resource="resource">
    <template #fields="{ state: form }">
      <AdminKeyedListFields
        :state="form"
        key-example="legenda-predaja"
        @update:state="Object.assign(form, $event)"
      />
    </template>
  </AdminResourcePage>
</template>
