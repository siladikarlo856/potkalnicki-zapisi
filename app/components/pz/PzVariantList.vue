<script setup lang="ts">
import type { Area, WordEntry } from '~/types/heritage'
import { REGION_FALLBACK_NAME } from '~~/shared/utils/word'

// "Kako se kaže po selima": one word's local forms, each with the villages that use it. The base form comes
// first (on the muted ground, with its badge), then the other forms by the number of villages. The chip always
// shows the settlement name, never an id. Six chips show; "+N" opens the rest in place.
// The marker beside each form differs by shape, not only by tone, so it works without colour.
const props = defineProps<{
  entry: WordEntry
  areas: Area[]
}>()

const { t } = useI18n()
const count = usePzCount()

const PREVIEW = 6
const MARKERS = [
  'rounded-full border-2 border-primary',
  'border-2 border-primary',
  'rotate-45 border-2 border-primary',
  'rounded-full bg-primary'
] as const

const sample = computed(() => props.entry.status === 'placeholder')

const forms = computed(() => {
  const names = new Map(props.areas.map(area => [area.id, area.name]))
  const rows = props.entry.variants.map((variant, index) => {
    const villages = [...new Set(variant.usages.map(usage => names.get(usage.areaId) ?? usage.areaId))]
    return { id: variant.id, form: variant.form, base: index === 0, villages }
  })
  const [base, ...others] = rows
  others.sort((a, b) => b.villages.length - a.villages.length)
  return base ? [base, ...others] : []
})

const expanded = ref(new Set<string>())
function visible(row: { id: string, villages: string[] }) {
  return expanded.value.has(row.id) ? row.villages : row.villages.slice(0, PREVIEW)
}
function expand(id: string) {
  expanded.value = new Set([...expanded.value, id])
}
</script>

<template>
  <ul
    class="flex flex-col gap-3"
    data-testid="pz-variant-list"
  >
    <li
      v-for="(row, index) in forms"
      :key="row.id"
      class="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 rounded-(--pz-radius-lg) border border-default p-4"
      :class="row.base ? 'bg-muted' : 'bg-default'"
      data-testid="pz-variant"
    >
      <span
        class="mt-2 block size-3.5"
        :class="MARKERS[index % MARKERS.length]"
        aria-hidden="true"
      />
      <div class="flex min-w-0 flex-col gap-2">
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            class="font-serif text-2xl/8 font-bold wrap-anywhere text-highlighted"
            lang="hr"
          >{{ row.form }}</span>
          <UBadge
            v-if="row.base"
            :label="t('pz.speech.baseForm')"
            color="neutral"
            variant="subtle"
            class="rounded-(--pz-radius-sm)"
          />
          <HeritageSampleBadge v-if="sample" />
        </div>
        <p class="pz-body-sm text-muted">
          {{ row.villages.length ? count('pz.speech.villageCount', row.villages.length) : t('pz.speech.villageUnknown') }}
        </p>
        <ul class="flex flex-wrap gap-2">
          <li
            v-for="village in visible(row)"
            :key="village"
          >
            <span class="pz-caption inline-flex items-center gap-1.5 rounded-full border border-default bg-default px-2.5 py-1 text-default">
              <UIcon
                name="i-lucide-map-pin"
                class="size-3.5 shrink-0 text-muted"
                aria-hidden="true"
              />
              {{ village }}
            </span>
          </li>
          <li v-if="!row.villages.length">
            <span class="pz-caption inline-flex items-center gap-1.5 rounded-full border border-dashed border-accented px-2.5 py-1 text-muted">
              {{ REGION_FALLBACK_NAME }}
            </span>
          </li>
          <li v-if="row.villages.length > PREVIEW && !expanded.has(row.id)">
            <button
              type="button"
              class="pz-caption min-h-(--pz-tap-min) rounded-full px-2.5 font-semibold text-primary underline underline-offset-2"
              :aria-label="t('pz.speech.showAllVillages', { n: row.villages.length - PREVIEW })"
              aria-expanded="false"
              @click="expand(row.id)"
            >
              +{{ row.villages.length - PREVIEW }}
            </button>
          </li>
        </ul>
      </div>
    </li>
  </ul>
</template>
