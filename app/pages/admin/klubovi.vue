<script setup lang="ts">
import {
  CLUB_VERIFICATION_LABELS, CLUB_VERIFICATIONS, validateClub, type Club, type ClubValue
} from '~~/shared/utils/content/club'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Klubovi', robots: 'noindex, nofollow' })

const augustReminder = computed(() => new Date().getMonth() === 7)

type ClubForm = ClubValue

const verificationOptions = CLUB_VERIFICATIONS.map(value => ({ label: CLUB_VERIFICATION_LABELS[value], value }))

const resource = defineAdminResource<Club, ClubForm>({
  kind: 'club',
  icon: 'i-lucide-trophy',
  editor: 'page',
  dialogWidth: 'wide',
  labels: {
    title: 'Klubovi',
    description: 'Sportski klubovi Potkalničkog prigorja — sezonske lige provjeravajte svaki kolovoz (HNS Semafor).',
    create: 'Novi klub',
    edit: 'Uredi klub',
    empty: 'Još nema kluba.',
    search: 'Pretraži klubove'
  },
  columns: [
    { key: 'name', label: 'Ime', sort: 'name' },
    { key: 'sport', label: 'Sport', sort: 'sport', hideBelow: 'sm' },
    { key: 'settlementLabel', label: 'Naselje', hideBelow: 'md' },
    { key: 'seasonSummary', label: 'Sezona', hideBelow: 'lg' },
    { key: 'verification', label: 'Provjera', sort: 'verification', hideBelow: 'md' }
  ],
  filters: [
    { key: 'verification', label: 'Status provjere', options: verificationOptions }
  ],
  defaultSort: 'name',
  blank: () => ({
    name: '', slug: '', fullName: null, sport: 'nogomet', settlementId: '', foundedYear: null, homeGround: null,
    researchNotes: '', verification: 'unverified', noindex: false, seasons: [], sourceIds: [], status: 'draft'
  }),
  toForm: club => ({
    name: club.name,
    slug: club.slug,
    fullName: club.fullName,
    sport: club.sport,
    settlementId: club.settlementId,
    foundedYear: club.foundedYear,
    homeGround: club.homeGround,
    researchNotes: club.researchNotes,
    verification: club.verification,
    noindex: club.noindex,
    seasons: club.seasons ?? [],
    sourceIds: club.sourceIds ?? [],
    status: club.status
  }),
  validate: form => validateClub(form).issues,
  label: club => club.name
})
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="augustReminder"
      color="warning"
      variant="subtle"
      icon="i-lucide-calendar-clock"
      title="Kolovoski podsjetnik"
      description="Sezone i lige brzo zastarjevaju — osvježite club_seasons iz HNS Semafora ili NSKKŽ-a prije nove sezone."
    />
    <AdminResourcePage :resource="resource">
      <template #settlementLabel-cell="{ row }">
        {{ row.settlementLabel ?? '—' }}
      </template>
      <template #seasonSummary-cell="{ row }">
        {{ row.seasonSummary ?? '—' }}
      </template>
      <template #fields="{ state: form, entity }">
        <AdminClubFields
          :state="form"
          :entity-id="entity?.id"
          @update:state="Object.assign(form, $event)"
        />
      </template>
    </AdminResourcePage>
  </div>
</template>
