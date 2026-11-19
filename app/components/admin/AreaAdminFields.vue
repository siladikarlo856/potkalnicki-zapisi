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
  <AdminFormField
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
  </AdminFormField>
  <AdminFormField
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
  </AdminFormField>
  <AdminFormField
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
  </AdminFormField>
  <div
    v-if="showRegions"
    class="grid gap-4 sm:grid-cols-2"
  >
    <AdminFormField
      name="officialCode"
      label="Službeni kod (DGU)"
      optional
    >
      <UInput
        :model-value="nullToUndefined(form.officialCode)"
        :maxlength="AREA_LIMITS.officialCode"
        class="w-full font-mono"
        @update:model-value="form.officialCode = undefinedToNull($event) ?? null"
      />
    </AdminFormField>
    <AdminFormField
      name="geonamesId"
      label="GeoNames ID"
      optional
    >
      <UInput
        :model-value="nullToUndefined(form.geonamesId)"
        :maxlength="AREA_LIMITS.geonamesId"
        inputmode="numeric"
        class="w-full font-mono"
        @update:model-value="form.geonamesId = undefinedToNull($event) ?? null"
      />
    </AdminFormField>
  </div>
  <div class="grid gap-4 sm:grid-cols-2">
    <AdminFormField
      name="latitude"
      label="Geografska širina"
      optional
    >
      <UInput
        v-model.number="form.latitude"
        type="number"
        step="any"
        class="w-full"
      />
    </AdminFormField>
    <AdminFormField
      name="longitude"
      label="Geografska dužina"
      optional
    >
      <UInput
        v-model.number="form.longitude"
        type="number"
        step="any"
        class="w-full"
      />
    </AdminFormField>
  </div>
  <AdminFormField
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
  </AdminFormField>
  <AdminRichTextField
    :model-value="form.description ?? ''"
    name="description"
    label="Opis"
    optional
    :maxlength="AREA_LIMITS.description"
    :rows="3"
    @update:model-value="form.description = undefinedToNull($event)"
  />
</template>
