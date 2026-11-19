<script setup lang="ts">
import {
  PERSON_VERIFICATION_LABELS, PERSON_VERIFICATIONS, validatePerson, type Person, type PersonValue
} from '~~/shared/utils/content/person'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Osobe', robots: 'noindex, nofollow' })

type PersonForm = PersonValue

const verificationOptions = PERSON_VERIFICATIONS.map(value => ({ label: PERSON_VERIFICATION_LABELS[value], value }))

const resource = defineAdminResource<Person, PersonForm>({
  kind: 'person',
  icon: 'i-lucide-user-round',
  editor: 'page',
  dialogWidth: 'wide',
  labels: {
    title: 'Osobe',
    description: 'Povijesne osobe Potkalničkog prigorja — samo preminule i povijesne zapise (D13). Javne stranice dolaze u sljedećem koraku.',
    create: 'Nova osoba',
    edit: 'Uredi osobu',
    empty: 'Još nema osoba.',
    search: 'Pretraži osobe'
  },
  columns: [
    { key: 'name', label: 'Ime', sort: 'name' },
    { key: 'yearsLabel', label: 'Godine', sort: 'diedYear', hideBelow: 'sm' },
    { key: 'placesLabel', label: 'Mjesta', hideBelow: 'md' },
    { key: 'verification', label: 'Provjera', sort: 'verification', hideBelow: 'md' }
  ],
  filters: [
    { key: 'verification', label: 'Status provjere', options: verificationOptions }
  ],
  defaultSort: 'name',
  blank: () => ({
    name: '', slug: '', role: '', clue: '', bio: null, born: null, bornYear: null, bornPlace: null,
    died: '', diedYear: 1900, diedPlace: null, openQuestions: null, researchNotes: '',
    verification: 'unverified', noindex: false, areaLinks: [], itemLinks: [], sourceIds: [], status: 'draft'
  }),
  toForm: person => ({
    name: person.name,
    slug: person.slug,
    role: person.role,
    clue: person.clue,
    bio: person.bio,
    born: person.born,
    bornYear: person.bornYear,
    bornPlace: person.bornPlace,
    died: person.died,
    diedYear: person.diedYear,
    diedPlace: person.diedPlace,
    openQuestions: person.openQuestions,
    researchNotes: person.researchNotes,
    verification: person.verification,
    noindex: person.noindex,
    areaLinks: person.areaLinks ?? [],
    itemLinks: person.itemLinks ?? [],
    sourceIds: person.sourceIds ?? [],
    status: person.status
  }),
  validate: form => validatePerson(form).issues,
  label: person => person.name
})
</script>

<template>
  <AdminResourcePage :resource="resource">
    <template #yearsLabel-cell="{ row }">
      {{ row.yearsLabel ?? '—' }}
    </template>
    <template #placesLabel-cell="{ row }">
      {{ row.placesLabel ?? '—' }}
    </template>
    <template #fields="{ state: form, entity }">
      <AdminPersonFields
        :state="form"
        :entity-id="entity?.id"
        @update:state="Object.assign(form, $event)"
      />
    </template>
  </AdminResourcePage>
</template>
