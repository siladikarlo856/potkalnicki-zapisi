<script setup lang="ts">
import { atlasSlug } from '#shared/utils/atlasSlug'
import { INTANGIBLE_LIMITS, INTANGIBLE_VERIFICATIONS, INTANGIBLE_VERIFICATION_LABELS } from '#shared/utils/content/intangible'
import { NARRATOR_LIMITS } from '#shared/utils/content/narrator'
import type { NarratorValue } from '#shared/utils/content/narrator'
import { numberOrNull, textOrNull } from '~/utils/intangibleForm'

// The editor of a Narrator (Kazivač). The rule it must make impossible to miss: without a recorded consent the public
// sees only the public description, never the name, and the name also stays out of the page address and the search.
const props = defineProps<{
  state: NarratorValue
  entityId?: string
}>()
const emit = defineEmits<{ 'update:state': [NarratorValue] }>()

function patch(partial: Partial<NarratorValue>) {
  emit('update:state', { ...props.state, ...partial })
}

const verificationOptions = INTANGIBLE_VERIFICATIONS.map(value => ({ label: INTANGIBLE_VERIFICATION_LABELS[value], value }))

/** What the public will see: the name only with consent, otherwise the description. */
const publicLabel = computed(() => (props.state.consentNamed ? props.state.name : props.state.publicDescription)?.trim() || '—')

// A new narrator's page address follows what the public sees (the name only with consent) until it is edited by hand.
const slugManual = ref(false)
watch(() => [props.state.name, props.state.publicDescription, props.state.consentNamed] as const, () => {
  if (slugManual.value || props.entityId) return
  patch({ slug: atlasSlug(props.state.consentNamed ? props.state.name : props.state.publicDescription ?? '') })
})

async function suggestSlug() {
  const base = props.state.slug || (props.state.consentNamed ? props.state.name : props.state.publicDescription) || ''
  if (!base) return
  const query: Record<string, string> = { base }
  if (props.entityId) query.exclude = props.entityId
  const result = await $fetch<{ slug: string }>('/api/admin/content/narrator/slug', { query })
  patch({ slug: result.slug })
  slugManual.value = true
}

const publicDescription = computed({
  get: () => props.state.publicDescription ?? '',
  set: (value: string) => patch({ publicDescription: textOrNull(value) })
})
const consentNote = computed({
  get: () => props.state.consentNote ?? '',
  set: (value: string) => patch({ consentNote: textOrNull(value) })
})
</script>

<template>
  <fieldset class="flex flex-col gap-4">
    <legend class="mb-2 text-sm font-semibold text-highlighted">
      Ime i javni prikaz
    </legend>
    <UFormField
      name="name"
      label="Ime i prezime (samo za urednike)"
      required
      description="Pravo ime. Javnost ga vidi samo uz pristanak ispod."
    >
      <UInput
        :model-value="state.name"
        :maxlength="NARRATOR_LIMITS.name"
        class="w-full"
        autofocus
        @update:model-value="value => patch({ name: String(value) })"
      />
    </UFormField>

    <UAlert
      :color="state.consentNamed ? 'success' : 'warning'"
      variant="subtle"
      :icon="state.consentNamed ? 'i-lucide-badge-check' : 'i-lucide-shield-alert'"
      :title="state.consentNamed ? 'Javnost vidi ime kazivača.' : 'Bez pristanka javnost vidi samo javni opis.'"
      data-test="admin-narrator-consent-alert"
    >
      <template #description>
        <p v-if="state.consentNamed">
          Pristanak je zabilježen. Ime se prikazuje na stranici kazivača i uz svaki zapis koji je ispričao.
        </p>
        <p v-else>
          Ime se nikada ne prikazuje javno, ne ulazi u pretragu i ne smije biti u adresi stranice ni u javnom opisu.
          Javni opis je obavezan.
        </p>
        <p class="mt-1">
          Javno se prikazuje: <strong data-test="admin-narrator-public-label">{{ publicLabel }}</strong>
        </p>
      </template>
    </UAlert>

    <UFormField
      name="consentNamed"
      label="Pristanak za javno navođenje imena"
      description="Označi tek kad je kazivač pristao da se njegovo ime objavi. Pristanak se bilježi ovdje, ne pretpostavlja se."
    >
      <USwitch
        :model-value="state.consentNamed"
        label="Kazivač je pristao da ga se javno navede imenom"
        data-test="admin-narrator-consent"
        @update:model-value="value => patch({ consentNamed: value === true })"
      />
    </UFormField>
    <UFormField
      name="consentNote"
      label="Bilješka o pristanku (nikada se ne prikazuje javno)"
      hint="Neobavezno"
      description="Kako i kad je pristanak dan, npr. „usmeno, 12. 3. 2026., uz snimku“. Vide je samo urednici."
    >
      <UTextarea
        v-model="consentNote"
        :maxlength="NARRATOR_LIMITS.consentNote"
        :rows="2"
        autoresize
        class="w-full"
      />
    </UFormField>
    <UFormField
      name="publicDescription"
      label="Javni opis"
      :required="!state.consentNamed"
      description="Anonimni opis koji javnost vidi umjesto imena, npr. „kazivačica, r. 1938., Gornji Fodrovec“. Ne smije sadržavati ime dok nema pristanka."
    >
      <UInput
        v-model="publicDescription"
        :maxlength="NARRATOR_LIMITS.publicDescription"
        class="w-full"
        data-test="admin-narrator-description"
      />
    </UFormField>
    <UFormField
      name="slug"
      label="Slug"
      required
      description="Adresa stranice kazivača. Bez pristanka se izvodi iz javnog opisa i ne smije sadržavati ime. Povlačenje pristanka briše stara preusmjeravanja s imenom."
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
      Podaci o kazivaču
    </legend>
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        name="living"
        label="Živ/a"
      >
        <USwitch
          :model-value="state.living"
          :label="state.living ? 'Živ/a' : 'Preminuo/la'"
          @update:model-value="value => patch({ living: value === true })"
        />
      </UFormField>
      <UFormField
        name="bornYear"
        label="Godina rođenja"
        hint="Neobavezno"
      >
        <UInput
          :model-value="state.bornYear ?? undefined"
          type="number"
          inputmode="numeric"
          class="w-full"
          @update:model-value="value => patch({ bornYear: numberOrNull(value) })"
        />
      </UFormField>
    </div>
    <UFormField
      name="settlementId"
      label="Mjesto življenja"
      hint="Neobavezno"
      description="Naselje u kojem kazivač živi ili je živio."
    >
      <AdminLookupSelect
        :model-value="state.settlementId"
        endpoint="/api/admin/lookup/area"
        scope="settlement"
        placeholder="Odaberi naselje"
        clearable
        @update:model-value="value => patch({ settlementId: value })"
      />
    </UFormField>
    <UFormField
      name="personId"
      label="Povijesna osoba"
      hint="Neobavezno"
      description="Samo ako je kazivač ujedno poznata povijesna osoba iz popisa Osobe. Jedna osoba može biti povezana s najviše jednim kazivačem."
    >
      <AdminLookupSelect
        :model-value="state.personId"
        endpoint="/api/admin/lookup/person"
        placeholder="Odaberi osobu"
        clearable
        @update:model-value="value => patch({ personId: value })"
      />
    </UFormField>
  </fieldset>

  <fieldset class="flex flex-col gap-4">
    <legend class="mb-2 text-sm font-semibold text-highlighted">
      Provjera i bilješke
    </legend>
    <UFormField
      name="verification"
      label="Status provjere"
      required
    >
      <USelect
        :model-value="state.verification"
        :items="verificationOptions"
        class="w-full"
        @update:model-value="value => patch({ verification: value as NarratorValue['verification'] })"
      />
    </UFormField>
    <UFormField
      name="researchNotes"
      label="Bilješka (privatno)"
    >
      <UTextarea
        :model-value="state.researchNotes"
        :maxlength="INTANGIBLE_LIMITS.researchNotes"
        :rows="3"
        autoresize
        class="w-full"
        @update:model-value="value => patch({ researchNotes: String(value) })"
      />
    </UFormField>
    <UFormField name="noindex">
      <UCheckbox
        :model-value="state.noindex"
        label="Ne indeksirati u tražilicama (noindex)"
        @update:model-value="value => patch({ noindex: value === true })"
      />
    </UFormField>
  </fieldset>
</template>
