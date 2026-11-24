<script setup lang="ts">
// A schematic map of the three municipalities and the town: a stand-in until real boundaries are loaded. Fills only
// tell areas apart; names and outlines carry the meaning, and the map is never the only way to reach a place.
// `selected` outlines one area in ink and dims the others; `crop` + `pin` make the locator in the facts panel.
const props = defineProps<{
  /** Write the area names on the map (Početna, Mjesta). */
  labels?: boolean
  /** One of the area ids. */
  selected?: string
  /** SVG viewBox crop for the locator: "0 30 358 130". */
  crop?: string
  /** Pin position and label for the locator. */
  pin?: { x: number, y: number, label?: string }
  /** The sentence that says what the map shows. */
  label?: string
}>()

const CONTOURS = ['M26 58C80 34 150 22 216 28S300 34 336 48', 'M40 66C92 46 150 36 214 42S292 48 322 58', 'M66 72C110 58 156 50 208 56S268 60 296 68', 'M120 70C146 62 170 60 196 66']
const PEAK = 'M160 58 170 40 180 58Z'

const description = computed(() => {
  if (props.label) return props.label
  const area = MAP_AREAS.find(a => a.id === props.selected)
  return area
    ? `Shematska karta s istaknutim područjem: ${area.name}`
    : 'Shematska karta triju općina i grada Križevaca s grebenom Kalnika'
})
</script>

<template>
  <div
    class="relative overflow-hidden rounded-lg border border-default bg-elevated"
    data-testid="schematic-map"
  >
    <svg
      :viewBox="crop ?? '0 0 358 210'"
      role="img"
      :aria-label="description"
      class="block h-auto w-full"
    >
      <rect
        width="358"
        height="210"
        fill="var(--ui-bg-elevated)"
      />
      <path
        v-for="area in MAP_AREAS"
        :key="area.id"
        :data-area="area.id"
        :d="area.d"
        :fill="area.fill"
        stroke-linejoin="round"
        :stroke="selected === area.id ? 'var(--ui-text)' : 'var(--ui-text-muted)'"
        :stroke-width="selected === area.id ? 3.5 : 1.5"
        :opacity="selected && selected !== area.id ? 0.6 : 1"
      />
      <g
        fill="none"
        stroke="var(--pz-map-line)"
        stroke-width="1.2"
        opacity=".35"
      >
        <path
          v-for="c in CONTOURS"
          :key="c"
          :d="c"
        />
      </g>
      <path
        :d="PEAK"
        fill="var(--pz-map-line)"
      />
      <template v-if="labels">
        <text
          v-for="area in MAP_AREAS"
          :key="area.id"
          :x="area.lx"
          :y="area.ly"
          text-anchor="middle"
          class="text-[12px] font-bold"
          fill="var(--ui-text-highlighted)"
          stroke="var(--ui-bg)"
          stroke-width="3.5"
          stroke-linejoin="round"
          paint-order="stroke fill"
        >{{ area.name }}</text>
      </template>
      <template v-if="pin">
        <circle
          :cx="pin.x"
          :cy="pin.y"
          r="9"
          fill="var(--pz-accent)"
          stroke="var(--pz-on-accent)"
          stroke-width="2.5"
          data-testid="map-pin"
        />
        <text
          v-if="pin.label"
          :x="pin.x + 15"
          :y="pin.y + 4"
          class="text-[12px] font-bold"
          fill="var(--ui-text-highlighted)"
          stroke="var(--ui-bg)"
          stroke-width="3.5"
          stroke-linejoin="round"
          paint-order="stroke fill"
        >{{ pin.label }}</text>
      </template>
    </svg>
  </div>
</template>
