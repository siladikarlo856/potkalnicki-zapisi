<script setup lang="ts">
/* eslint-disable vue/no-mutating-props -- `form` is the entity dialog's mutable state object. */
import { atlasSlug } from '~~/shared/utils/atlasSlug'
import {
  AREA_KINDS, AREA_KIND_LABELS, AREA_LIMITS, areaKindMayJoinRegion, type AreaKind, type AreaValue
} from '~~/shared/utils/content/area'

type AreaForm = Omit<AreaValue, 'status'>

/** Bind nullable form fields to inputs that expect `undefined` instead of `null`. */
function nullToUndefined(value: string | null) {
  return value ?? undefined
}
function undefinedToNull(value: string | undefined) {
  return value === undefined || value === '' ? null : value
}

const props = defineProps<{
  form: AreaForm
  entityId?: string
  regionOptions: Array<{ label: string, value: string }>
  loadParentOptions: (kind: AreaKind, q: string) => Promise<Array<{ label: string, value: string }>>
  parentHint: string
}>()

const kindOptions = AREA_KINDS.map(value => ({ label: AREA_KIND_LABELS[value], value }))

watch(() => props.form.name, (name) => {
  props.form.slug = atlasSlug(name) || null
})
watch(() => props.form.kind, () => {
  if (props.form.kind === 'country') props.form.parentId = null
})

const parentSearch = ref('')
const parentItems = ref<Array<{ label: string, value: string }>>([])
const parentLoading = ref(false)

async function refreshParents() {
  if (props.form.kind === 'country') {
    parentItems.value = []
    return
  }
  parentLoading.value = true
  try {
    parentItems.value = await props.loadParentOptions(props.form.kind, parentSearch.value)
    if (props.form.parentId && !parentItems.value.some(item => item.value === props.form.parentId)) {
      const resolved = await $fetch<{ items: Array<{ id: string, label: string }> }>('/api/admin/lookup/area', {
        query: { ids: props.form.parentId }
      })
      if (resolved.items[0]) {
        parentItems.value = [{ label: resolved.items[0].label, value: resolved.items[0].id }, ...parentItems.value]
      }
    }
  } finally {
    parentLoading.value = false
  }
}

watch(() => props.form.kind, () => refreshParents(), { immediate: true })
watch(parentSearch, () => refreshParents())

const showRegions = computed(() => areaKindMayJoinRegion(props.form.kind))
</script>

<template>
  <UFormField
    name="kind"
    label="Vrsta"
    required
  >
    <USelect
      v-model="form.kind"
      :items="kindOptions"
      class="w-full"
      :disabled="!!entityId"
    />
  </UFormField>
  <UFormField
    name="name"
    label="Naziv"
    required
  >
    <UInput
      v-model="form.name"
      :maxlength="AREA_LIMITS.name"
      class="w-full"
      autofocus
    />
  </UFormField>
  <UFormField
    v-if="form.kind !== 'country'"
    name="parentId"
    label="Nadređeno mjesto"
    required
    :description="parentHint"
  >
    <USelectMenu
      v-model:search-term="parentSearch"
      :model-value="nullToUndefined(form.parentId)"
      :items="parentItems"
      value-key="value"
      searchable
      :loading="parentLoading"
      placeholder="Pretraži i odaberi…"
      class="w-full"
      @update:model-value="form.parentId = undefinedToNull($event) ?? null"
    />
  </UFormField>
  <div
    v-if="showRegions"
    class="grid gap-4 sm:grid-cols-2"
  >
    <UFormField
      name="officialCode"
      label="Službeni kod (DGU)"
      hint="Neobavezno"
    >
      <UInput
        :model-value="nullToUndefined(form.officialCode)"
        :maxlength="AREA_LIMITS.officialCode"
        class="w-full font-mono"
        @update:model-value="form.officialCode = undefinedToNull($event) ?? null"
      />
    </UFormField>
    <UFormField
      name="geonamesId"
      label="GeoNames ID"
      hint="Neobavezno"
    >
      <UInput
        :model-value="nullToUndefined(form.geonamesId)"
        :maxlength="AREA_LIMITS.geonamesId"
        inputmode="numeric"
        class="w-full font-mono"
        @update:model-value="form.geonamesId = undefinedToNull($event) ?? null"
      />
    </UFormField>
  </div>
  <div class="grid gap-4 sm:grid-cols-2">
    <UFormField
      name="latitude"
      label="Geografska širina"
      hint="Neobavezno"
    >
      <UInput
        v-model.number="form.latitude"
        type="number"
        step="any"
        class="w-full"
      />
    </UFormField>
    <UFormField
      name="longitude"
      label="Geografska dužina"
      hint="Neobavezno"
    >
      <UInput
        v-model.number="form.longitude"
        type="number"
        step="any"
        class="w-full"
      />
    </UFormField>
  </div>
  <UFormField
    v-if="showRegions"
    name="regionIds"
    label="Regije"
    description="Članstvo u regiji određuje je li mjesto u opsegu Potkalničkog prigorja na javnom atlasu."
  >
    <USelectMenu
      v-model="form.regionIds"
      :items="regionOptions"
      value-key="value"
      multiple
      searchable
      placeholder="Odaberi regije…"
      class="w-full"
    />
  </UFormField>
  <UFormField
    name="description"
    label="Opis"
    hint="Neobavezno"
  >
    <UTextarea
      :model-value="nullToUndefined(form.description)"
      :maxlength="AREA_LIMITS.description"
      :rows="3"
      autoresize
      class="w-full"
      @update:model-value="form.description = undefinedToNull($event) ?? null"
    />
  </UFormField>
</template>
