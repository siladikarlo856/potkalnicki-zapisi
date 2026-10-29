<script setup lang="ts">
import type { WordInput } from '~~/shared/utils/word'
import { WORD_STATUSES, SOURCE_KINDS } from '~~/shared/utils/word'

const model = defineModel<WordInput>({ required: true })
const props = defineProps<{ busy: boolean }>()
const emit = defineEmits<{ save: [active: boolean], cancel: [] }>()
const areasJson = ref(JSON.stringify(model.value.areas, null, 2))
const areaError = ref('')
const tags = computed({ get: () => model.value.entry.tags?.join(', ') ?? '', set: (value: string) => {
  model.value.entry.tags = value.split(',').map(v => v.trim()).filter(Boolean)
} })
const areaOptions = computed(() => model.value.areas.map(area => ({ label: `${area.name} · ${area.kind}`, value: area.id })))
const sourceOptions = computed(() => [{ label: 'Bez izvora', value: '__none__' }, ...model.value.entry.sources.map(source => ({ label: source.credit || source.id, value: source.id }))])

function updateAreas() {
  try {
    const value = JSON.parse(areasJson.value)
    if (!Array.isArray(value) || value.some(a => !a || typeof a.id !== 'string' || typeof a.name !== 'string')) throw new Error()
    model.value.areas = value
    areaError.value = ''
    return true
  } catch {
    areaError.value = 'Područja trebaju biti JSON popis s ID-jem, nazivom, vrstom i parentId-jem.'
    return false
  }
}
function save(active: boolean) {
  if (updateAreas()) emit('save', active)
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
      Skica ostaje privatna. Za aktivaciju ispuni naslovnu riječ, hrvatsko značenje, vrstu riječi, izvore i područja svake inačice. Prva inačica mora biti naslovna riječ.
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
            @update:model-value="value => example.areaId = value === '__none__' ? undefined : String(value)"
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
              v-model="usage.areaId"
              :items="areaOptions"
              class="w-full"
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
            @click="variant.usages.push({ areaId: model.areas[0]?.id ?? '', confidence: 'reported' })"
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
      label="Definicije područja · napredno (JSON)"
      :error="areaError || undefined"
      description="Javni podaci. Za novo naselje dodaj objekt s jedinstvenim id, name, kind: settlement i parentId. Mogući dodatni parametri: alsoIn, centroid, boundaryRef, externalIds. Roditelji moraju biti u ovom popisu."
    >
      <UTextarea
        v-model="areasJson"
        :rows="8"
        class="w-full font-mono text-xs"
        @blur="updateAreas"
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
