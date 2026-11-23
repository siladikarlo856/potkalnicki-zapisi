<script setup lang="ts">
import type { WordInput } from '~~/shared/utils/word'
import { WORD_STATUSES, SOURCE_KINDS, MAX_DISTRACTORS, NOTE_LIMIT, DISTRACTOR_LIMIT } from '~~/shared/utils/word'
import { DAILY_CATEGORIES } from '~~/shared/utils/dailyWord'
import type { Area } from '~~/app/types/heritage'

const $fetch = useEditorialFetch()

const model = defineModel<WordInput>({ required: true })
const props = defineProps<{ busy: boolean }>()
const emit = defineEmits<{ save: [active: boolean], cancel: [] }>()
const { t } = useI18n()
const categoryItems = computed(() => [{ label: 'Bez kategorije', value: '__none__' }, ...DAILY_CATEGORIES.map(value => ({ label: `${t(`daily.category.${value}`)} · ${value}`, value }))])
const noteHr = computed({ get: () => model.value.entry.note?.hr ?? '', set: (hr: string) => {
  model.value.entry.note = { ...model.value.entry.note, hr }
} })
const noteEn = computed({ get: () => model.value.entry.note?.en ?? '', set: (en: string) => {
  model.value.entry.note = { hr: model.value.entry.note?.hr ?? '', en }
} })
const tags = computed({ get: () => model.value.entry.tags?.join(', ') ?? '', set: (value: string) => {
  model.value.entry.tags = value.split(',').map(v => v.trim()).filter(Boolean)
} })
const sourceOptions = computed(() => [{ label: 'Bez izvora', value: '__none__' }, ...model.value.entry.sources.map(source => ({ label: source.credit || source.id, value: source.id }))])

// Published areas from the database, used as the area picker source.
const { data: dbAreas } = await useFetch<Area[]>('/api/review/areas', { $fetch, default: () => [] as Area[] })
// All areas available for selection: the DB list is the authoritative source.
const allAreas = computed(() => dbAreas.value ?? [])
const areaOptions = computed(() => allAreas.value.map(area => ({ label: `${area.name} · ${area.kind}`, value: area.id })))

function hierarchyFor(ids: string[]) {
  const byId = new Map(allAreas.value.map(area => [area.id, area]))
  const included = new Set(ids)
  for (const id of ids) {
    let parentId = byId.get(id)?.parentId ?? null
    while (parentId && !included.has(parentId)) {
      included.add(parentId)
      parentId = byId.get(parentId)?.parentId ?? null
    }
  }
  return allAreas.value.filter(area => included.has(area.id))
}

// Track which areas are included in the word's hierarchy.
// The `areas` column is maintained by the DB trigger from entry usages; here we let the admin
// pick areas directly for the hierarchy used by usage selects in the editor.
const selectedAreaIds = ref<string[]>(model.value.areas.map(a => a.id))

// When selected areas change, update the model areas so the usage selects have the right options.
watch(selectedAreaIds, (ids) => {
  model.value.areas = hierarchyFor(ids)
}, { immediate: false })

// When the model areas change externally (e.g. on load), sync selectedAreaIds.
watch(() => model.value.areas, (areas) => {
  const inModel = areas.map(a => a.id)
  const inDb = allAreas.value.map(a => a.id)
  // Keep only ids that the DB knows about; add any that are only in areas (legacy keys resolved to UUIDs)
  const next = [...new Set([...inModel.filter(id => inDb.includes(id)), ...inModel])]
  if (next.length !== selectedAreaIds.value.length || next.some((id, index) => id !== selectedAreaIds.value[index])) {
    selectedAreaIds.value = next
  }
}, { immediate: true })

function chooseArea(set: (id: string) => void, value: unknown) {
  const id = String(value)
  set(id)
  if (!selectedAreaIds.value.includes(id)) selectedAreaIds.value = [...selectedAreaIds.value, id]
}

function save(active: boolean) {
  emit('save', active)
}
function addSource() {
  model.value.entry.sources.push({ id: crypto.randomUUID(), kind: 'editor', credit: '' })
}
function addVariant() {
  model.value.entry.variants.push({ id: crypto.randomUUID(), form: '', status: model.value.entry.status, usages: [] })
}
</script>

<template>
  <form
    class="flex flex-col gap-6"
    @submit.prevent="save(model.active)"
  >
    <p class="text-sm text-muted">
      Skica ostaje privatna. Za aktivaciju ispuni naslovnu riječ, hrvatsko značenje, vrstu riječi i izvore. Područja inačica nisu obavezna: inačica bez područja prikazuje se za cijelu regiju (Potkalničko prigorje). Prva inačica mora biti naslovna riječ.
    </p>
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="Naslovna riječ">
        <UInput
          v-model="model.entry.headword"
          class="w-full"
          :maxlength="200"
        />
      </UFormField>
      <UFormField label="Vrsta riječi">
        <UInput
          v-model="model.entry.partOfSpeech"
          class="w-full"
          :maxlength="100"
          placeholder="npr. imenica, ž. r."
        />
      </UFormField>
      <UFormField label="Značenje · HR">
        <UTextarea
          v-model="model.entry.meaning.hr"
          class="w-full"
          :maxlength="2000"
        />
      </UFormField>
      <UFormField label="Meaning · EN">
        <UTextarea
          v-model="model.entry.meaning.en"
          class="w-full"
          :maxlength="2000"
        />
      </UFormField>
      <UFormField label="Status sadržaja">
        <USelect
          v-model="model.entry.status"
          :items="[...WORD_STATUSES]"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Oznake (odvojene zarezom)">
        <UInput
          v-model="tags"
          class="w-full"
        />
      </UFormField>
    </div>

    <section class="flex flex-col gap-3">
      <h3 class="text-lg font-semibold text-highlighted">
        Riječ dana
      </h3>
      <p class="text-sm text-muted">
        Nije obavezno za aktivaciju. Ako su netočni odgovori prazni, biraju se automatski iz značenja drugih riječi. Promjene vrijede od sljedećeg dana ako je riječ danas već objavljena.
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField label="Kategorija (trag)">
          <USelect
            :model-value="model.entry.category || '__none__'"
            :items="categoryItems"
            class="w-full"
            @update:model-value="value => model.entry.category = value === '__none__' ? undefined : value as typeof model.entry.category"
          />
        </UFormField>
        <span class="hidden sm:block" />
        <UFormField label="Objašnjenje / zanimljivost · HR">
          <UTextarea
            v-model="noteHr"
            class="w-full"
            :maxlength="NOTE_LIMIT"
          />
        </UFormField>
        <UFormField label="Explanation / fun fact · EN">
          <UTextarea
            v-model="noteEn"
            class="w-full"
            :maxlength="NOTE_LIMIT"
          />
        </UFormField>
      </div>
      <div
        v-for="(distractor, index) in model.entry.distractors"
        :key="index"
        class="grid gap-3 rounded-lg bg-elevated p-3 sm:grid-cols-2"
      >
        <UFormField label="Netočan odgovor · HR">
          <UInput
            v-model="distractor.hr"
            class="w-full"
            :maxlength="DISTRACTOR_LIMIT"
          />
        </UFormField>
        <UFormField label="Wrong answer · EN">
          <UInput
            v-model="distractor.en"
            class="w-full"
            :maxlength="DISTRACTOR_LIMIT"
          />
        </UFormField>
        <UButton
          label="Ukloni netočan odgovor"
          color="neutral"
          variant="ghost"
          class="justify-self-start"
          @click="model.entry.distractors?.splice(index, 1)"
        />
      </div>
      <UButton
        v-if="(model.entry.distractors?.length ?? 0) < MAX_DISTRACTORS"
        label="Dodaj netočan odgovor (ručno, do 3)"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        class="self-start"
        @click="(model.entry.distractors ??= []).push({ hr: '' })"
      />
    </section>

    <section class="flex flex-col gap-3">
      <h3 class="text-lg font-semibold text-highlighted">
        Primjeri
      </h3>
      <div
        v-for="(example, index) in model.entry.examples"
        :key="index"
        class="grid gap-3 rounded-lg bg-elevated p-3 sm:grid-cols-2"
      >
        <UFormField label="Primjer">
          <UTextarea
            v-model="example.text"
            class="w-full"
            :maxlength="2000"
          />
        </UFormField>
        <UFormField label="Prijevod">
          <UTextarea
            v-model="example.translation"
            class="w-full"
            :maxlength="2000"
          />
        </UFormField>
        <UFormField label="Područje">
          <USelect
            :model-value="example.areaId || '__none__'"
            :items="[{ label: 'Bez područja', value: '__none__' }, ...areaOptions]"
            class="w-full"
            @update:model-value="value => value === '__none__' ? example.areaId = undefined : chooseArea(id => example.areaId = id, value)"
          />
        </UFormField>
        <UButton
          label="Ukloni primjer"
          color="neutral"
          variant="ghost"
          class="self-end justify-self-start"
          @click="model.entry.examples?.splice(index, 1)"
        />
      </div>
      <UButton
        label="Dodaj primjer"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        class="self-start"
        @click="(model.entry.examples ??= []).push({ text: '' })"
      />
    </section>

    <section class="flex flex-col gap-3">
      <h3 class="text-lg font-semibold text-highlighted">
        Inačice i upotreba
      </h3>
      <div
        v-for="(variant, index) in model.entry.variants"
        :key="variant.id"
        class="flex flex-col gap-3 rounded-lg bg-elevated p-4"
      >
        <p class="text-xs text-muted wrap-anywhere">
          Inačica {{ index + 1 }} · {{ variant.id }}
        </p>
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="Oblik">
            <UInput
              v-model="variant.form"
              class="w-full"
              :maxlength="200"
            />
          </UFormField>
          <UFormField label="Status inačice">
            <USelect
              v-model="variant.status"
              :items="[...WORD_STATUSES]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Izgovor">
            <UInput
              v-model="variant.pronunciation"
              class="w-full"
              :maxlength="200"
            />
          </UFormField>
          <UFormField label="Audio (HTTPS URL)">
            <UInput
              v-model="variant.audio"
              class="w-full"
              :maxlength="1000"
            />
          </UFormField>
        </div>
        <div
          v-for="(usage, usageIndex) in variant.usages"
          :key="usageIndex"
          class="grid gap-3 rounded-lg bg-default p-3 sm:grid-cols-2"
        >
          <UFormField label="Područje upotrebe">
            <USelect
              :model-value="usage.areaId"
              :items="areaOptions"
              class="w-full"
              @update:model-value="value => chooseArea(id => usage.areaId = id, value)"
            />
          </UFormField>
          <UFormField label="Pouzdanost">
            <USelect
              v-model="usage.confidence"
              :items="[{ label: 'Prijavljeno · reported', value: 'reported' }, { label: 'Potvrđeno · confirmed', value: 'confirmed' }]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Izvor upotrebe">
            <USelect
              :model-value="usage.sourceId || '__none__'"
              :items="sourceOptions"
              class="w-full"
              @update:model-value="value => usage.sourceId = value === '__none__' ? undefined : String(value)"
            />
          </UFormField>
          <UFormField label="Bilješka (javna)">
            <UInput
              v-model="usage.note"
              class="w-full"
              :maxlength="500"
            />
          </UFormField>
          <UButton
            label="Ukloni područje"
            color="neutral"
            variant="ghost"
            class="justify-self-start"
            @click="variant.usages.splice(usageIndex, 1)"
          />
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            label="Dodaj područje"
            icon="i-lucide-map-pin-plus"
            color="neutral"
            variant="outline"
            @click="variant.usages.push({ areaId: allAreas[0]?.id ?? '', confidence: 'reported' })"
          />
          <UButton
            label="Ukloni inačicu"
            color="neutral"
            variant="ghost"
            @click="model.entry.variants.splice(index, 1)"
          />
        </div>
      </div>
      <UButton
        label="Dodaj inačicu"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        class="self-start"
        @click="addVariant"
      />
    </section>

    <section class="flex flex-col gap-3">
      <h3 class="text-lg font-semibold text-highlighted">
        Izvori i zasluge
      </h3>
      <p class="text-sm text-muted">
        Ovi podaci bit će javni uz aktivnu riječ. Ne unosi kontakt ni privatne bilješke.
      </p>
      <div
        v-for="(source, index) in model.entry.sources"
        :key="source.id"
        class="grid gap-3 rounded-lg bg-elevated p-3 sm:grid-cols-2"
      >
        <p class="text-xs text-muted wrap-anywhere sm:col-span-2">
          ID: {{ source.id }}
        </p>
        <UFormField label="Vrsta izvora">
          <USelect
            v-model="source.kind"
            :items="[...SOURCE_KINDS]"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Zasluge / javni navod izvora">
          <UInput
            v-model="source.credit"
            class="w-full"
            :maxlength="300"
          />
        </UFormField>
        <UButton
          label="Ukloni izvor"
          color="neutral"
          variant="ghost"
          class="justify-self-start"
          @click="model.entry.sources.splice(index, 1)"
        />
      </div>
      <UButton
        label="Dodaj izvor"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        class="self-start"
        @click="addSource"
      />
    </section>

    <UFormField
      label="Područja upotrebe"
      description="Odaberi područja čiji će se nazivi prikazivati u padajućim izbornicima za inačice i primjere. Hijerarhija (roditelji) dodaje se automatski. Područja koja nisu odabrana ovdje neće se moći dodijeliti inačicama."
    >
      <USelectMenu
        v-model="selectedAreaIds"
        :items="areaOptions"
        value-key="value"
        multiple
        searchable
        placeholder="Odaberi područja…"
        class="w-full"
      />
    </UFormField>
    <div class="flex flex-wrap gap-2 border-t border-default pt-4">
      <UButton
        type="submit"
        :label="model.active ? 'Spremi aktivnu riječ' : 'Spremi skicu'"
        icon="i-lucide-save"
        :loading="props.busy"
      />
      <UButton
        v-if="!model.active"
        label="Spremi i aktiviraj"
        icon="i-lucide-check"
        :disabled="props.busy"
        @click="save(true)"
      />
      <UButton
        v-else
        label="Spremi i deaktiviraj"
        color="neutral"
        variant="outline"
        :disabled="props.busy"
        @click="save(false)"
      />
      <UButton
        label="Odustani"
        color="neutral"
        variant="ghost"
        :disabled="props.busy"
        @click="emit('cancel')"
      />
    </div>
  </form>
</template>
