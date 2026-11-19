<script setup lang="ts">
import { INTANGIBLE_VERIFICATIONS, INTANGIBLE_VERIFICATION_LABELS } from '#shared/utils/content/intangible'
import { validateNarrator } from '#shared/utils/content/narrator'
import type { Narrator, NarratorValue } from '#shared/utils/content/narrator'
import { blankNarrator, narratorToForm } from '~/utils/intangibleForm'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Kazivači', robots: 'noindex, nofollow' })

const verificationOptions = INTANGIBLE_VERIFICATIONS.map(value => ({ label: INTANGIBLE_VERIFICATION_LABELS[value], value }))

const resource = defineAdminResource<Narrator, NarratorValue>({
  kind: 'narrator',
  icon: 'i-lucide-mic',
  dialogWidth: 'wide',
  labels: {
    title: 'Kazivači',
    description: 'Tko je ispričao, otpjevao ili opisao zapis, i tko ga je zapisao. Javnost vidi ime samo uz zabilježen pristanak, inače javni opis.',
    create: 'Novi kazivač',
    edit: 'Uredi kazivača',
    empty: 'Još nema kazivača.',
    search: 'Pretraži kazivače po imenu'
  },
  columns: [
    { key: 'name', label: 'Ime (samo urednici)', sort: 'name' },
    { key: 'consentNamed', label: 'Javno', hideBelow: 'sm' },
    { key: 'publicDescription', label: 'Javni opis', hideBelow: 'md' },
    { key: 'settlementLabel', label: 'Mjesto', hideBelow: 'lg' },
    { key: 'verification', label: 'Provjera', sort: 'verification', hideBelow: 'lg' }
  ],
  filters: [{ key: 'verification', label: 'Status provjere', options: verificationOptions }],
  defaultSort: 'name',
  blank: blankNarrator,
  toForm: narratorToForm,
  validate: form => validateNarrator(form).issues,
  label: narrator => narrator.name
})
</script>

<template>
  <AdminResourcePage :resource="resource">
    <template #consentNamed-cell="{ row }">
      <UBadge
        :label="row.consentNamed ? 'Ime javno' : 'Samo opis'"
        :color="row.consentNamed ? 'success' : 'warning'"
        variant="subtle"
        data-test="admin-narrator-consent-badge"
      />
    </template>
    <template #publicDescription-cell="{ row }">
      <span class="block max-w-xs truncate">{{ row.publicDescription ?? '—' }}</span>
    </template>

    <template #fields="{ state: form, entity }">
      <AdminNarratorFields
        :state="form"
        :entity-id="entity?.id"
        @update:state="Object.assign(form, $event)"
      />
    </template>
  </AdminResourcePage>
</template>
