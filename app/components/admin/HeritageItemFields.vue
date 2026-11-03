<script setup lang="ts">
import { atlasSlug } from '~~/shared/utils/atlasSlug'
import type { ContentLookupItem } from '~~/shared/utils/content/common'
import { HERITAGE_ITEM_LIMITS, type HeritageItemValue } from '~~/shared/utils/content/heritageItem'

const props = defineProps<{
  state: HeritageItemValue
  entityId?: string
  categoryOptions: Array<{ label: string, value: string }>
  verificationOptions: Array<{ label: string, value: string }>
  heritageStatusOptions: Array<{ label: string, value: string }>
}>()

const emit = defineEmits<{ 'update:state': [HeritageItemValue] }>()

function patch(partial: Partial<HeritageItemValue>) {
  emit('update:state', { ...props.state, ...partial })
}

function bind<K extends keyof HeritageItemValue>(key: K) {
  return computed({
    get: () => props.state[key],
    set: (value: HeritageItemValue[K]) => patch({ [key]: value } as Partial<HeritageItemValue>)
  })
}

function bindNullableString<K extends keyof HeritageItemValue>(key: K) {
  return computed({
    get: () => props.state[key] as string | null ?? '',
    set: (value: string) => patch({ [key]: (value || null) as HeritageItemValue[K] })
  })
}

const name = bind('name')
const categoryId = bind('categoryId')
const municipalityId = bind('municipalityId')
const verification = bind('verification')
const researchNotes = bind('researchNotes')
const sourceIds = bind('sourceIds')
const noindex = bind('noindex')
const slug = bind('slug')
const settlementId = computed({
  get: () => props.state.settlementId ?? undefined,
  set: (value: string | undefined) => patch({ settlementId: value ?? null })
})
const locality = bindNullableString('locality')
const description = bindNullableString('description')
const period = bindNullableString('period')
const registryNumber = bindNullableString('registryNumber')
const latitude = bind('latitude')
const longitude = bind('longitude')

const slugManual = ref(false)

watch(() => props.state.name, (value) => {
  if (slugManual.value || props.entityId) return
  patch({ slug: atlasSlug(value) })
})

watch(() => props.state.slug, () => {
  slugManual.value = true
})

function setHeritageStatus(value: string) {
  patch({
    heritageStatus: value === '__none__'
      ? null
      : value as Exclude<HeritageItemValue['heritageStatus'], '__none__'>
  })
}

async function suggestSlug() {
  const base = props.state.slug || props.state.name
  if (!base) return
  const query: Record<string, string> = { base }
  if (props.state.settlementId) query.scope = props.state.settlementId
  if (props.entityId) query.exclude = props.entityId
  const result = await $fetch<{ slug: string }>(`/api/admin/content/heritage_item/slug`, { query })
  patch({ slug: result.slug })
  slugManual.value = true
}

const municipalitySearch = ref('')
const settlementSearch = ref('')
const sourceSearch = ref('')

const municipalityQuery = computed(() => ({
  scope: 'municipality',
  q: municipalitySearch.value.trim() || undefined,
  ids: props.state.municipalityId && !municipalitySearch.value ? props.state.municipalityId : undefined
}))
const { data: municipalityLookup } = useFetch<{ items: ContentLookupItem[] }>('/api/admin/lookup/area', {
  query: municipalityQuery,
  server: false
})
const municipalityItems = computed(() => (municipalityLookup.value?.items ?? []).map(item => ({ label: item.label, value: item.id })))

const settlementQuery = computed(() => ({
  scope: 'settlement',
  parent: props.state.municipalityId || undefined,
  q: settlementSearch.value.trim() || undefined,
  ids: props.state.settlementId && !settlementSearch.value ? props.state.settlementId : undefined
}))
const settlementEnabled = computed(() => !!props.state.municipalityId)
const { data: settlementLookup, refresh: refreshSettlements } = useFetch<{ items: ContentLookupItem[] }>('/api/admin/lookup/area', {
  query: settlementQuery,
  server: false
})
watch(settlementEnabled, enabled => enabled && refreshSettlements())
const settlementItems = computed(() => (settlementLookup.value?.items ?? []).map(item => ({ label: item.label, value: item.id })))

watch(() => props.state.municipalityId, (next, prev) => {
  if (prev && next !== prev) patch({ settlementId: null })
})

const sourceQuery = computed(() => ({
  q: sourceSearch.value.trim() || undefined,
  ids: props.state.sourceIds.length && !sourceSearch.value ? props.state.sourceIds.join(',') : undefined
}))
const { data: sourceLookup } = useFetch<{ items: ContentLookupItem[] }>('/api/admin/lookup/source', {
  query: sourceQuery,
  server: false
})
const sourceItems = computed(() => (sourceLookup.value?.items ?? []).map(item => ({ label: item.label, value: item.id })))

function onSlugInput() {
  slugManual.value = true
}
</script>

<template>
  <UFormField
    name="name"
    label="Naziv"
    required
  >
    <UInput
      v-model="name"
      :maxlength="HERITAGE_ITEM_LIMITS.name"
      class="w-full"
      autofocus
    />
  </UFormField>
  <UFormField
    name="categoryId"
    label="Kategorija"
    required
  >
    <USelect
      v-model="categoryId"
      :items="categoryOptions"
      placeholder="Odaberi kategoriju"
      class="w-full"
    />
  </UFormField>
  <UFormField
    name="municipalityId"
    label="Grad ili općina"
    required
  >
    <USelectMenu
      v-model="municipalityId"
      v-model:search-term="municipalitySearch"
      :items="municipalityItems"
      value-key="value"
      placeholder="Pretraži gradove i općine"
      class="w-full"
    />
  </UFormField>
  <UFormField
    name="settlementId"
    label="Naselje"
    hint="Neobavezno; bez naselja nema javne stranice zapisa."
  >
    <USelectMenu
      v-model="settlementId"
      v-model:search-term="settlementSearch"
      :items="settlementItems"
      value-key="value"
      :disabled="!settlementEnabled"
      placeholder="Pretraži naselja"
      class="w-full"
    />
  </UFormField>
  <UFormField
    name="locality"
    label="Lokalitet"
    hint="Neobavezno"
  >
    <UInput
      v-model="locality"
      :maxlength="HERITAGE_ITEM_LIMITS.locality"
      class="w-full"
    />
  </UFormField>
  <UFormField
    name="verification"
    label="Status provjere"
    required
  >
    <USelect
      v-model="verification"
      :items="verificationOptions"
      class="w-full"
    />
  </UFormField>
  <UFormField
    name="researchNotes"
    label="Bilješke istraživanja"
  >
    <UTextarea
      v-model="researchNotes"
      :maxlength="HERITAGE_ITEM_LIMITS.researchNotes"
      :rows="4"
      autoresize
      class="w-full"
    />
  </UFormField>
  <UFormField
    name="description"
    label="Opis"
    hint="Neobavezno"
  >
    <UTextarea
      v-model="description"
      :maxlength="HERITAGE_ITEM_LIMITS.description"
      :rows="3"
      autoresize
      class="w-full"
    />
  </UFormField>
  <div class="grid gap-4 sm:grid-cols-2">
    <UFormField
      name="period"
      label="Razdoblje"
    >
      <UInput
        v-model="period"
        :maxlength="HERITAGE_ITEM_LIMITS.period"
        class="w-full"
      />
    </UFormField>
    <UFormField
      name="registryNumber"
      label="Registarski broj"
    >
      <UInput
        v-model="registryNumber"
        :maxlength="HERITAGE_ITEM_LIMITS.registryNumber"
        class="w-full"
      />
    </UFormField>
  </div>
  <UFormField
    name="heritageStatus"
    label="Status u registru"
  >
    <USelect
      :model-value="state.heritageStatus ?? '__none__'"
      :items="heritageStatusOptions"
      class="w-full"
      @update:model-value="setHeritageStatus"
    />
  </UFormField>
  <UFormField
    name="sourceIds"
    label="Izvori"
    description="Redoslijed odgovara prikazu na javnoj stranici."
  >
    <USelectMenu
      v-model="sourceIds"
      v-model:search-term="sourceSearch"
      :items="sourceItems"
      value-key="value"
      multiple
      placeholder="Pretraži izvore"
      class="w-full"
    />
  </UFormField>
  <div class="grid gap-4 sm:grid-cols-2">
    <UFormField
      name="latitude"
      label="Geografska širina"
    >
      <UInput
        v-model="latitude"
        type="number"
        step="any"
        class="w-full"
      />
    </UFormField>
    <UFormField
      name="longitude"
      label="Geografska dužina"
    >
      <UInput
        v-model="longitude"
        type="number"
        step="any"
        class="w-full"
      />
    </UFormField>
  </div>
  <UFormField name="noindex">
    <UCheckbox
      v-model="noindex"
      label="Ne indeksirati u tražilicama (noindex)"
    />
  </UFormField>
  <UFormField
    name="slug"
    label="Adresa (slug)"
    required
    description="Koristi se u URL-u. Stara adresa preusmjerava nakon objave."
  >
    <div class="flex gap-2">
      <UInput
        v-model="slug"
        :maxlength="HERITAGE_ITEM_LIMITS.slug"
        class="w-full font-mono text-sm"
        @input="onSlugInput"
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
</template>
