<script setup lang="ts">
import { AREA_RELATIONS, AREA_RELATION_LABELS, INTANGIBLE_MAX } from '#shared/utils/content/intangible'
import type { AreaLink, AreaRelation } from '#shared/utils/content/intangible'

// Places of a record at any level (a settlement, a municipality, a region), in two groups: where it was recorded
// ("Zabilježeno u") and what it is about ("Odnosi se na"). Several of each are allowed; the saved list keeps both
// groups in one array, so a row's index in the whole list is what the validator names in its issues.
const props = defineProps<{ links: AreaLink[] }>()
const emit = defineEmits<{ 'update:links': [AreaLink[]] }>()

const HINTS: Record<AreaRelation, string> = {
  recorded_in: 'Gdje je zapis ispričan, izveden ili zabilježen.',
  about: 'Na koje se mjesto ili kraj priča, običaj ili tekst odnosi.'
}

const groups = computed(() => AREA_RELATIONS.map(relation => ({
  relation,
  label: AREA_RELATION_LABELS[relation],
  hint: HINTS[relation],
  rows: props.links.map((link, index) => ({ link, index })).filter(row => row.link.relation === relation)
})))
const full = computed(() => props.links.length >= INTANGIBLE_MAX.areaLinks)

function add(relation: AreaRelation) {
  if (!full.value) emit('update:links', [...props.links, { areaId: '', relation }])
}

function setArea(index: number, areaId: string | null) {
  emit('update:links', props.links.map((link, position) => position === index ? { ...link, areaId: areaId ?? '' } : link))
}

function remove(index: number) {
  emit('update:links', props.links.filter((_, position) => position !== index))
}
</script>

<template>
  <fieldset class="flex flex-col gap-4">
    <legend class="mb-2 text-sm font-semibold text-highlighted">
      Mjesta
    </legend>
    <div
      v-for="group in groups"
      :key="group.relation"
      class="flex flex-col gap-2"
      :data-test="`admin-areas-${group.relation}`"
    >
      <div>
        <p class="text-sm font-medium text-highlighted">
          {{ group.label }}
        </p>
        <p class="text-sm text-muted">
          {{ group.hint }}
        </p>
      </div>
      <AdminFormField
        v-for="row in group.rows"
        :key="row.index"
        :name="`areaLinks.${row.index}.areaId`"
      >
        <div class="flex gap-2">
          <AdminLookupSelect
            :model-value="row.link.areaId || null"
            endpoint="/api/admin/lookup/area"
            scope="all"
            placeholder="Naselje, općina, grad ili regija"
            @update:model-value="setArea(row.index, $event)"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            type="button"
            :aria-label="`Ukloni mjesto (${group.label})`"
            @click="remove(row.index)"
          />
        </div>
      </AdminFormField>
      <div>
        <UButton
          :label="`Dodaj mjesto: ${group.label.toLowerCase()}`"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          type="button"
          :disabled="full"
          @click="add(group.relation)"
        />
      </div>
    </div>
  </fieldset>
</template>
