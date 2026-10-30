<script setup lang="ts">
import type { AreaUsage } from '~/types/heritage'

const props = defineProps<{
  usage: AreaUsage
  /** Sample data: the link between this form and the area is only an example. */
  sample?: boolean
  /** Adds an English gloss to the sample note, for /en visitors. */
  english?: boolean
}>()

const { areaById, areaTrail } = useHeritage()

const name = computed(() => areaById.value.get(props.usage.areaId)?.name ?? props.usage.areaId)
const trail = computed(() => areaTrail(props.usage.areaId).map(area => area.name))
const title = computed(() => {
  const text = trail.value.join(' › ')
  if (!props.sample) return text
  return props.english ? `${text} — nije provjereno (not verified)` : `${text} — nije provjereno`
})
// The title tooltip is hover-only, so screen readers get the same details as hidden text.
const srDetails = computed(() => {
  const parents = trail.value.slice(1).map(name => `, ${name}`).join('')
  return props.sample ? `${parents} (nije provjereno)` : parents
})
</script>

<template>
  <span
    :title="title"
    class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap"
    :class="sample ? 'border border-dashed border-accented text-muted' : 'bg-elevated text-toned ring ring-default ring-inset'"
  >
    <UIcon
      name="i-lucide-map-pin"
      class="size-3 shrink-0"
    />
    {{ name }}<span
      v-if="srDetails"
      class="sr-only"
    >{{ srDetails }}</span><span
      v-if="sample && english"
      class="sr-only"
      lang="en"
    > (not verified)</span>
  </span>
</template>
