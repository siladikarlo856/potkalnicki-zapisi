<script setup lang="ts">
import type { AreaUsage } from '~/types/heritage'

const props = defineProps<{
  usage: AreaUsage
  /** Sample data: the link between this form and the area is only an example. */
  sample?: boolean
}>()

const { areaById, areaTrail } = useHeritage()

const name = computed(() => areaById.value.get(props.usage.areaId)?.name ?? props.usage.areaId)
const title = computed(() => {
  const trail = areaTrail(props.usage.areaId).map(area => area.name).join(' › ')
  return props.sample ? `${trail} — nije provjereno` : trail
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
    {{ name }}
  </span>
</template>
