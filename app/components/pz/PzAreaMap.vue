<script setup lang="ts">
// Area map: the towns and municipalities drawn from their real boundaries (OpenStreetMap, the games' map frame) for
// the place pages. It mirrors the list beside it (PzPlaceExplorer) and is never the only way to a place: an area or a
// point answers a pointer (a click opens it, hovering marks its card), while keyboard and screen-reader users reach
// every place through the list, so the drawing is one image named by `label`. Fills only tell neighbours apart; the
// outline and the name carry the meaning. `selected` zooms to one area and dims the others; `active` outlines an area
// or lifts a point and names it; a zoomed map leaves the selected area unnamed, as the page title names it. Names and points sit over the drawing in CSS pixels, so they keep their size at any zoom.
import { MUNICIPALITY_BOUNDARIES } from '#shared/utils/games/mapBoundaries'
import { MAP_FRAME, project } from '#shared/utils/games/mapFrame'

export interface PzAreaMapArea {
  /** Town or municipality slug: the key of its boundary. */
  slug: string
  /** The name written on the map: "Križevci". */
  name: string
  to?: string
}

export interface PzAreaMapPoint {
  id: string
  lat: number
  lng: number
  name: string
  to?: string
}

const props = defineProps<{
  areas: PzAreaMapArea[]
  /** Zoom to this area and dim the others (a municipality page). */
  selected?: string
  /** The area slug or point id under the pointer or focus in the list. */
  active?: string
  points?: PzAreaMapPoint[]
  /** The sentence that says what the map shows. */
  label: string
}>()

const emit = defineEmits<{ hover: [id: string | undefined] }>()

/** Width / height of the map: the five areas together are about square. */
const ASPECT = 1

const drawn = computed(() => props.areas.flatMap((area) => {
  const boundary = MUNICIPALITY_BOUNDARIES[area.slug]
  if (!boundary) return []
  const ring = pathPoints(boundary.d)
  const box = pointsBox(ring)
  const style = AREA_MAP_STYLE[area.slug]
  return [{
    ...area,
    d: boundary.d,
    ring,
    box,
    fill: style?.fill ?? 'var(--pz-map-1)',
    at: style?.label ?? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }]
}))

const view = computed(() => {
  const focus = drawn.value.find(area => area.slug === props.selected)
  const boxes = focus ? [focus.box] : drawn.value.map(area => area.box)
  if (!boxes.length) return { x: 0, y: 0, width: MAP_FRAME.width, height: MAP_FRAME.height }
  return fitBox(unionBox(boxes), ASPECT, focus ? 0.08 : 0.03)
})

/** A frame position as a share of the map box, for what is laid over the drawing. */
function place(x: number, y: number) {
  return { left: (x - view.value.x) / view.value.width * 100, top: (y - view.value.y) / view.value.height * 100 }
}
const inView = ({ left, top }: { left: number, top: number }) => left > 4 && left < 96 && top > 4 && top < 96

const strong = (slug: string) => slug === props.active || slug === props.selected
// SVG paints in document order: the outlined area last, so its outline is never covered by a neighbour's.
const ordered = computed(() => [...drawn.value].sort((a, b) => Number(strong(a.slug)) - Number(strong(b.slug))))

type MapPos = { left: number, top: number }
/** Two names closer than this (in % of the map) would overlap. */
const apart = (a: MapPos, b: MapPos) => Math.abs(a.left - b.left) > 20 || Math.abs(a.top - b.top) > 8

/**
 * A neighbour whose label point lies outside a zoomed map is named at the in-view point inside its boundary nearest
 * that label point, clear of the names already placed, so it still points the way.
 */
function nameInside(area: (typeof drawn.value)[number], placed: MapPos[]) {
  const { x, y, width, height } = view.value
  let best: MapPos | undefined
  let bestDistance = Infinity
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j <= 10; j++) {
      const px = x + width * (0.14 + 0.072 * i)
      const py = y + height * (0.1 + 0.08 * j)
      const distance = Math.hypot(px - area.at.x, py - area.at.y)
      const pos = place(px, py)
      if (distance < bestDistance && placed.every(other => apart(pos, other)) && insideRing(px, py, area.ring)) {
        bestDistance = distance
        best = pos
      }
    }
  }
  return best
}

// A zoomed map names only the neighbours: the selected area's name is already the page's title.
const names = computed(() => {
  const others = drawn.value.filter(area => area.slug !== props.selected)
  const named = others.flatMap((area) => {
    const pos = place(area.at.x, area.at.y)
    return inView(pos) ? [{ slug: area.slug, name: area.name, pos }] : []
  })
  if (!props.selected) return named
  for (const area of others) {
    if (named.some(name => name.slug === area.slug)) continue
    const pos = nameInside(area, named.map(name => name.pos))
    if (pos) named.push({ slug: area.slug, name: area.name, pos })
  }
  return named
})

const dots = computed(() => (props.points ?? []).map((point) => {
  const { x, y } = project(point.lat, point.lng)
  return { ...point, pos: place(x, y), active: point.id === props.active }
}).sort((a, b) => Number(a.active) - Number(b.active)))

function open(to?: string) {
  if (to) navigateTo(to)
}
</script>

<template>
  <div
    class="relative overflow-hidden rounded-lg border border-default bg-elevated"
    data-testid="area-map"
    :data-selected="selected"
  >
    <svg
      :viewBox="`${view.x} ${view.y} ${view.width} ${view.height}`"
      role="img"
      :aria-label="label"
      class="block aspect-square h-auto w-full"
      @pointerleave="emit('hover', undefined)"
    >
      <path
        v-for="area in ordered"
        :key="area.slug"
        :data-area="area.slug"
        :d="area.d"
        :fill="area.fill"
        :stroke="strong(area.slug) ? 'var(--ui-text-highlighted)' : 'var(--ui-border-accented)'"
        :stroke-width="area.slug === active ? 3.5 : strong(area.slug) ? 2.5 : 1.25"
        :opacity="selected && !strong(area.slug) ? 0.5 : 1"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
        :class="area.to && 'cursor-pointer'"
        @pointerenter="emit('hover', area.slug)"
        @click="open(area.to)"
      />
    </svg>
    <div
      class="pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      <span
        v-for="area in names"
        :key="area.slug"
        :data-area-name="area.slug"
        class="absolute max-w-28 -translate-1/2 rounded-(--pz-radius-xs) px-1.5 py-0.5 text-center text-[0.8125rem]/4 font-bold text-balance"
        :class="area.slug === active
          ? 'bg-inverted text-inverted'
          : selected && area.slug !== selected ? 'bg-default/80 text-muted' : 'bg-default/90 text-highlighted'"
        :style="{ left: `${area.pos.left}%`, top: `${area.pos.top}%` }"
      >{{ area.name }}</span>
      <span
        v-for="dot in dots"
        :key="dot.id"
        :data-point="dot.id"
        class="pointer-events-auto absolute grid size-6 -translate-1/2 place-items-center"
        :class="dot.to && 'cursor-pointer'"
        :style="{ left: `${dot.pos.left}%`, top: `${dot.pos.top}%` }"
        @pointerenter="emit('hover', dot.id)"
        @pointerleave="emit('hover', undefined)"
        @click="open(dot.to)"
      >
        <span
          class="block rounded-full border-2"
          :class="dot.active ? 'size-4 border-(--pz-on-accent) bg-(--pz-accent)' : 'size-2.5 border-(--ui-bg) bg-primary'"
        />
        <span
          v-if="dot.active"
          class="absolute top-1/2 -translate-y-1/2 rounded-(--pz-radius-xs) bg-inverted px-1.5 py-0.5 text-[0.8125rem]/4 font-bold whitespace-nowrap text-inverted"
          :class="dot.pos.left > 60 ? 'right-full' : 'left-full'"
        >{{ dot.name }}</span>
      </span>
    </div>
    <a
      href="https://www.openstreetmap.org/copyright"
      class="absolute right-0 bottom-0 rounded-tl-(--pz-radius-xs) bg-default/85 px-1.5 py-0.5 text-[0.6875rem]/4 text-muted no-underline hover:underline"
      data-testid="area-map-credit"
    >Granice © OpenStreetMap suradnici</a>
  </div>
</template>
