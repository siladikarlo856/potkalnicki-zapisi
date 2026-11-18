<script setup lang="ts">
import { atlasSlug } from '#shared/utils/atlasSlug'
import type { AreaLink, NarratorLink } from '#shared/utils/content/intangible'
import {
  INTANGIBLE_LIMITS, INTANGIBLE_MAX, INTANGIBLE_VERIFICATIONS, INTANGIBLE_VERIFICATION_LABELS
} from '#shared/utils/content/intangible'
import { removeEntry, textOrNull } from '~/utils/intangibleForm'
import type { IntangibleFormState } from '~/utils/intangibleForm'

// The editor of a Story, a Custom or a Folk text. The three share most of their form (title, type, places, people,
// time, links, attestation and notes) and differ in their texts and one link each, so one component takes the kind.
const props = defineProps<{
  kind: 'story' | 'custom' | 'folk_text'
  state: IntangibleFormState
  entityId?: string
  /** The kind's type list as menu options (a Draft or archived type says so). */
  typeOptions: Array<{ label: string, value: string }>
}>()
const emit = defineEmits<{ 'update:state': [IntangibleFormState] }>()

const NOUNS = {
  story: { type: 'Vrsta priče', period: 'Vrijeme radnje' },
  custom: { type: 'Vrsta običaja', period: 'Vrijeme prakse' },
  folk_text: { type: 'Vrsta usmenog teksta', period: undefined }
} as const
const nouns = computed(() => NOUNS[props.kind])
const hasTexts = computed(() => props.kind !== 'custom')

function patch(partial: Partial<IntangibleFormState>) {
  emit('update:state', { ...props.state, ...partial })
}

// A new record's slug follows its title until the editor edits the slug by hand.
const slugManual = ref(false)
watch(() => props.state.title, (value) => {
  if (slugManual.value || props.entityId) return
  patch({ slug: atlasSlug(value) })
})

async function suggestSlug() {
  const base = props.state.slug || props.state.title
  if (!base) return
  const query: Record<string, string> = { base }
  if (props.entityId) query.exclude = props.entityId
  const result = await $fetch<{ slug: string }>(`/api/admin/content/${props.kind}/slug`, { query })
  patch({ slug: result.slug })
  slugManual.value = true
}

const verificationOptions = INTANGIBLE_VERIFICATIONS.map(value => ({ label: INTANGIBLE_VERIFICATION_LABELS[value], value }))

function text(key: 'textLocal' | 'textStandard' | 'description' | 'researchNotes') {
  return computed({
    get: () => props.state[key] ?? '',
    set: (value: string) => patch({ [key]: key === 'researchNotes' ? value : textOrNull(value) })
  })
}
const textLocal = text('textLocal')
const textStandard = text('textStandard')
const description = text('description')
const researchNotes = text('researchNotes')

const quotes = computed(() => props.state.quotes ?? [])
function setQuote(index: number, value: string) {
  patch({ quotes: quotes.value.map((quote, position) => position === index ? value : quote) })
}
const steps = computed(() => props.state.steps ?? [])
function setStep(index: number, value: string) {
  patch({ steps: steps.value.map((step, position) => position === index ? value : step) })
}
</script>

<template>
  <fieldset class="flex flex-col gap-4">
    <legend class="mb-2 text-sm font-semibold text-highlighted">
      Osnovno
    </legend>
    <UFormField
      name="title"
      label="Naslov"
      required
    >
      <UInput
        :model-value="state.title"
        :maxlength="INTANGIBLE_LIMITS.title"
        class="w-full"
        autofocus
        @update:model-value="value => patch({ title: String(value) })"
      />
    </UFormField>
    <UFormField
      name="typeId"
      :label="nouns.type"
      required
    >
      <USelect
        :model-value="state.typeId || undefined"
        :items="typeOptions"
        placeholder="Odaberi vrstu"
        class="w-full"
        data-test="admin-type"
        @update:model-value="value => patch({ typeId: String(value) })"
      />
    </UFormField>
    <UFormField
      v-if="kind === 'custom'"
      name="occasionId"
      label="Prigoda"
      hint="Neobavezno"
      description="Dan, blagdan ili životni događaj kojem običaj pripada, npr. Martinje."
    >
      <AdminLookupSelect
        :model-value="state.occasionId ?? null"
        endpoint="/api/admin/lookup/occasion"
        placeholder="Odaberi prigodu"
        clearable
        @update:model-value="value => patch({ occasionId: value })"
      />
    </UFormField>
    <UFormField
      v-if="kind === 'folk_text'"
      name="customId"
      label="Običaj kojem je pripadao"
      hint="Neobavezno"
      description="„Govorilo se ili pjevalo kad“: običaj u kojem se tekst izgovarao."
    >
      <AdminLookupSelect
        :model-value="state.customId ?? null"
        endpoint="/api/admin/lookup/custom"
        placeholder="Odaberi običaj"
        clearable
        @update:model-value="value => patch({ customId: value })"
      />
    </UFormField>
    <UFormField
      name="slug"
      label="Slug"
      required
      description="Adresa stranice. Prazno polje se popunjava iz naslova."
    >
      <div class="flex gap-2">
        <UInput
          :model-value="state.slug"
          :maxlength="INTANGIBLE_LIMITS.slug"
          class="w-full font-mono text-sm"
          @update:model-value="value => { slugManual = true; patch({ slug: String(value) }) }"
        />
        <UButton
          label="Predloži"
          color="neutral"
          variant="outline"
          type="button"
          @click="suggestSlug"
        />
      </div>
    </UFormField>
  </fieldset>

  <fieldset class="flex flex-col gap-4">
    <legend class="mb-2 text-sm font-semibold text-highlighted">
      {{ hasTexts ? 'Tekst' : 'Opis' }}
    </legend>
    <template v-if="hasTexts">
      <UFormField
        name="textLocal"
        label="Izvorni tekst (mjesni govor)"
        description="Onako kako je ispričano ili pjevano. Objava traži izvorni ili standardni tekst, barem jedan."
      >
        <UTextarea
          v-model="textLocal"
          :maxlength="INTANGIBLE_LIMITS.text"
          :rows="8"
          autoresize
          class="w-full"
          lang="hr"
        />
      </UFormField>
      <UFormField
        name="textStandard"
        label="Standardni prepričani tekst"
        description="Prepričano na hrvatskom standardnom jeziku."
      >
        <UTextarea
          v-model="textStandard"
          :maxlength="INTANGIBLE_LIMITS.text"
          :rows="8"
          autoresize
          class="w-full"
          lang="hr"
        />
      </UFormField>
    </template>
    <template v-else>
      <UFormField
        name="description"
        label="Opis običaja"
        required
        description="Kako se običaj provodio. Objava traži opis."
      >
        <UTextarea
          v-model="description"
          :maxlength="INTANGIBLE_LIMITS.text"
          :rows="8"
          autoresize
          class="w-full"
        />
      </UFormField>
      <UFormField
        name="quotes"
        label="Citati"
        hint="Neobavezno"
        description="Kratki citati u mjesnom govoru, redom kojim se prikazuju."
      >
        <div class="flex flex-col gap-2">
          <UFormField
            v-for="(quote, index) in quotes"
            :key="index"
            :name="`quotes.${index}`"
          >
            <div class="flex gap-2">
              <UInput
                :model-value="quote"
                :maxlength="INTANGIBLE_LIMITS.quote"
                :aria-label="`Citat ${index + 1}`"
                class="w-full"
                lang="hr"
                @update:model-value="value => setQuote(index, String(value))"
              />
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                type="button"
                :aria-label="`Ukloni citat ${index + 1}`"
                @click="patch({ quotes: removeEntry(quotes, index) })"
              />
            </div>
          </UFormField>
          <div>
            <UButton
              label="Dodaj citat"
              icon="i-lucide-plus"
              color="neutral"
              variant="outline"
              size="sm"
              type="button"
              :disabled="quotes.length >= INTANGIBLE_MAX.quotes"
              @click="patch({ quotes: [...quotes, ''] })"
            />
          </div>
        </div>
      </UFormField>
      <UFormField
        name="steps"
        label="Koraci"
        hint="Neobavezno"
        description="Radnje običaja redom, npr. za igru na dlanu."
      >
        <div class="flex flex-col gap-2">
          <UFormField
            v-for="(step, index) in steps"
            :key="index"
            :name="`steps.${index}`"
          >
            <div class="flex gap-2">
              <UInput
                :model-value="step"
                :maxlength="INTANGIBLE_LIMITS.step"
                :aria-label="`Korak ${index + 1}`"
                class="w-full"
                @update:model-value="value => setStep(index, String(value))"
              />
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                type="button"
                :aria-label="`Ukloni korak ${index + 1}`"
                @click="patch({ steps: removeEntry(steps, index) })"
              />
            </div>
          </UFormField>
          <div>
            <UButton
              label="Dodaj korak"
              icon="i-lucide-plus"
              color="neutral"
              variant="outline"
              size="sm"
              type="button"
              :disabled="steps.length >= INTANGIBLE_MAX.steps"
              @click="patch({ steps: [...steps, ''] })"
            />
          </div>
        </div>
      </UFormField>
    </template>
  </fieldset>

  <AdminIntangibleWhen
    :state="state"
    :period-label="nouns.period"
    @patch="patch"
  />

  <AdminIntangiblePlaces
    :links="state.areaLinks"
    @update:links="(links: AreaLink[]) => patch({ areaLinks: links })"
  />

  <AdminIntangiblePeople
    :narrators="state.narrators"
    :author-ids="state.authorIds"
    @update:narrators="(links: NarratorLink[]) => patch({ narrators: links })"
    @update:author-ids="ids => patch({ authorIds: ids })"
  />

  <fieldset class="flex flex-col gap-4">
    <legend class="mb-2 text-sm font-semibold text-highlighted">
      Poveznice
    </legend>
    <UFormField
      name="itemIds"
      label="Povezana baština"
      hint="Neobavezno"
      description="Crkve, kapele, križevi i drugi zapisi baštine na koje se zapis odnosi."
    >
      <AdminLookupList
        :model-value="state.itemIds"
        endpoint="/api/admin/lookup/heritage_item"
        placeholder="Dodaj zapis baštine"
        empty="Nema povezane baštine."
        noun="zapis baštine"
        :max="INTANGIBLE_MAX.items"
        @update:model-value="ids => patch({ itemIds: ids })"
      />
    </UFormField>
    <UFormField
      name="themeIds"
      label="Teme"
      hint="Neobavezno"
      description="Teme dijele sve vrste zapisa. Nova tema se dodaje na stranici Teme."
    >
      <AdminLookupList
        :model-value="state.themeIds"
        endpoint="/api/admin/lookup/theme"
        placeholder="Dodaj temu"
        empty="Nema tema."
        noun="temu"
        :max="INTANGIBLE_MAX.themes"
        @update:model-value="ids => patch({ themeIds: ids })"
      />
    </UFormField>
    <UFormField
      v-if="kind === 'folk_text'"
      name="wordIds"
      label="Riječi iz teksta"
      hint="Neobavezno"
      description="Riječi iz rječnika mjesnog govora koje tekst sadrži."
    >
      <AdminLookupList
        :model-value="state.wordIds ?? []"
        endpoint="/api/admin/lookup/word"
        placeholder="Dodaj riječ"
        empty="Nema povezanih riječi."
        noun="riječ"
        :max="INTANGIBLE_MAX.words"
        @update:model-value="ids => patch({ wordIds: ids })"
      />
    </UFormField>
    <UFormField
      name="sourceIds"
      label="Izvori"
      hint="Neobavezno"
      description="Redom kojim se navode. Snimke se za sada navode kao izvor."
    >
      <AdminLookupList
        :model-value="state.sourceIds"
        endpoint="/api/admin/lookup/source"
        placeholder="Dodaj izvor"
        empty="Nema izvora."
        noun="izvor"
        :max="INTANGIBLE_MAX.sources"
        @update:model-value="ids => patch({ sourceIds: ids })"
      />
    </UFormField>
  </fieldset>

  <fieldset class="flex flex-col gap-4">
    <legend class="mb-2 text-sm font-semibold text-highlighted">
      Provjera i bilješke
    </legend>
    <UFormField
      name="verification"
      label="Potvrđenost (atribucija)"
      required
      description="Potvrđuje da se zaista ovako pričalo ili činilo u ovom kraju, ne da je sadržaj istinit. Nikad ne priječi objavu. „Provjereno“ traži kazivača ili izvor."
    >
      <USelect
        :model-value="state.verification"
        :items="verificationOptions"
        class="w-full"
        @update:model-value="value => patch({ verification: value as IntangibleFormState['verification'] })"
      />
    </UFormField>
    <UFormField
      name="researchNotes"
      label="Bilješke istraživanja (privatno)"
    >
      <UTextarea
        v-model="researchNotes"
        :maxlength="INTANGIBLE_LIMITS.researchNotes"
        :rows="4"
        autoresize
        class="w-full"
      />
    </UFormField>
    <UFormField name="noindex">
      <UCheckbox
        :model-value="state.noindex"
        label="Ne indeksirati u tražilicama (noindex)"
        @update:model-value="value => patch({ noindex: value === true })"
      />
    </UFormField>
    <p class="text-sm text-muted">
      Zahvale pošiljatelju sjećanja dodaju se same pri objavi skice nastale iz sjećanja, samo uz ime i privolu.
    </p>
  </fieldset>
</template>
