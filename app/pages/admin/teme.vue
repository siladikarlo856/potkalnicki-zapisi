<script setup lang="ts">
import { atlasSlug } from '#shared/utils/atlasSlug'
import { INTANGIBLE_LIST_LIMITS, validateTheme } from '#shared/utils/content/intangibleList'
import type { Theme } from '#shared/utils/content/intangibleList'
import { INTANGIBLE_LIMITS } from '#shared/utils/content/intangible'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Teme', robots: 'noindex, nofollow' })

interface ThemeForm {
  slug: string
  labelHr: string
  labelEn: string
  description: string
  sort: number
  status: Theme['status']
}

const resource = defineAdminResource<Theme, ThemeForm>({
  kind: 'theme',
  icon: 'i-lucide-shapes',
  labels: {
    title: 'Teme',
    description: 'Teme koje dijele priče, običaji i usmeni tekstovi. Svaka tema ima vlastitu javnu stranicu.',
    create: 'Nova tema',
    edit: 'Uredi temu',
    empty: 'Još nema tema.',
    search: 'Pretraži teme'
  },
  columns: [
    { key: 'labelHr', label: 'Naziv', sort: 'labelHr' },
    { key: 'slug', label: 'Adresa', sort: 'slug', hideBelow: 'md' },
    { key: 'sort', label: 'Redoslijed', sort: 'sort', hideBelow: 'lg' }
  ],
  defaultSort: 'sort',
  blank: () => ({ slug: '', labelHr: '', labelEn: '', description: '', sort: 0, status: 'published' }),
  toForm: row => ({
    slug: row.slug, labelHr: row.labelHr, labelEn: row.labelEn ?? '', description: row.description ?? '', sort: row.sort, status: row.status
  }),
  validate: form => validateTheme({ ...form, labelEn: form.labelEn || null, description: form.description || null }).issues,
  label: row => row.labelHr
})

// A new theme's slug follows its Croatian name until the slug is edited by hand.
const slugManual = ref(false)
function setLabel(form: ThemeForm, entity: Theme | null, value: string) {
  form.labelHr = value
  if (!slugManual.value && !entity) form.slug = atlasSlug(value)
}
</script>

<template>
  <AdminResourcePage :resource="resource">
    <template #fields="{ state, entity }">
      <UFormField
        name="labelHr"
        label="Naziv (hr)"
        required
      >
        <UInput
          :model-value="state.labelHr"
          :maxlength="INTANGIBLE_LIST_LIMITS.labelHr"
          class="w-full"
          autofocus
          @update:model-value="value => setLabel(state, entity, String(value))"
        />
      </UFormField>
      <UFormField
        name="labelEn"
        label="Naziv (en)"
        hint="Neobavezno"
      >
        <UInput
          v-model="state.labelEn"
          :maxlength="INTANGIBLE_LIST_LIMITS.labelEn"
          class="w-full"
        />
      </UFormField>
      <UFormField
        name="slug"
        label="Adresa"
        required
        description="Mala slova bez kvačica, riječi odvojene crticom. Prazno polje se popunjava iz naziva."
      >
        <UInput
          v-model="state.slug"
          :maxlength="INTANGIBLE_LIMITS.slug"
          class="w-full font-mono text-sm"
          @input="slugManual = true"
        />
      </UFormField>
      <UFormField
        name="description"
        label="Opis"
        hint="Neobavezno"
        description="Prikazuje se na javnoj stranici teme."
      >
        <UTextarea
          v-model="state.description"
          :maxlength="INTANGIBLE_LIST_LIMITS.description"
          :rows="4"
          autoresize
          class="w-full"
        />
      </UFormField>
      <UFormField
        name="sort"
        label="Redoslijed"
        description="Manji broj ide ranije."
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
