<script setup lang="ts">
import { MAP_FRAME, MAP_LAYERS, project, unproject, type MapLayerId } from '#shared/utils/games/mapFrame'
import { MUNICIPALITY_BOUNDARIES } from '#shared/utils/games/mapBoundaries'
import { municipalityColor, sortedMunicipalities } from '#shared/utils/games/mapUnits'
import type { Difficulty } from '#shared/utils/games/types'
import type { PoolMunicipality, PoolPlace } from '#shared/utils/learn/types'

const props = withDefaults(defineProps<{
  places: PoolPlace[]
  municipalities: PoolMunicipality[]
  difficulty: Difficulty
  mode: 'find' | 'target' | 'learn'
  highlightId?: string
  singleTarget?: boolean
  /** Challenge map-target: highlight one coordinate without settlement names. */
  targetPoint?: { lat: number, lng: number }
  /** Challenge map-points: numbered dots aligned with multiple-choice options. */
  numberedPoints?: { lat: number, lng: number }[]
  /** Lock the basemap layer (challenges always use Karta). */
  layerLocked?: MapLayerId
  feedback?: { tap: { x: number, y: number }, target: { x: number, y: number }, km?: number } | null
  disabled?: boolean
}>(), {
  feedback: null,
  disabled: false,
  singleTarget: false
})

const emit = defineEmits<{
  pick: [payload: { placeId?: string, lat: number, lng: number, imageX: number, imageY: number }]
  selectIndex: [index: number]
}>()

const { t } = useI18n()
const colorMode = useColorMode()
const { scores, setMapLayer } = useGameScores()

const layerId = ref<MapLayerId>(props.layerLocked ?? scores.value.mapLayer ?? 'karta')
const availableLayers = computed(() => MAP_LAYERS.filter(l => l.available))
const activeLayer = computed(() => MAP_LAYERS.find(l => l.id === layerId.value) ?? MAP_LAYERS[0]!)

watch(layerId, (id) => {
  if (props.layerLocked) return
  if (MAP_LAYERS.find(l => l.id === id)?.available) setMapLayer(id)
})

watch(() => props.layerLocked, (locked) => {
  if (locked) layerId.value = locked
}, { immediate: true })

const viewport = useTemplateRef<HTMLElement>('viewport')
/** Zoom is CSS pixels per frame pixel. Until the viewport is measured, assume a phone-sized one. */
const FALLBACK_SCALE = 0.25
const MAX_ZOOM_IN = 4
const scale = ref(FALLBACK_SCALE)
const translate = ref({ x: 0, y: 0 })
/** True while the view moves by itself (reset, fit after an answer), so it glides instead of jumping. */
const gliding = ref(false)
/** Once the player zooms or pans, a resize keeps their view instead of re-fitting the whole area. */
let touched = false

/** The scale at which the whole frame (all five municipalities) fits the viewport: default and minimum zoom. */
function fitScale() {
  const el = viewport.value
  if (!el || !el.clientWidth || !el.clientHeight) return FALLBACK_SCALE
  return Math.min(el.clientWidth / MAP_FRAME.width, el.clientHeight / MAP_FRAME.height)
}
const maxScale = () => Math.max(2, fitScale() * MAX_ZOOM_IN)

const dark = computed(() => colorMode.value === 'dark')

const sortedPlaces = computed(() =>
  [...props.places].sort((a, b) => a.name.localeCompare(b.name, 'hr')))

const visibleDots = computed(() => {
  if (props.numberedPoints?.length) return []
  if (props.targetPoint) return []
  if (props.mode === 'learn') return props.places
  if (props.difficulty === 'tesko' && props.mode === 'find') return []
  if (props.singleTarget || props.mode === 'target') {
    const id = props.highlightId
    return id ? props.places.filter(p => p.id === id) : []
  }
  return props.places
})

const challengeMarkers = computed(() => {
  if (props.numberedPoints?.length) {
    return props.numberedPoints.map((point, index) => ({
      key: `numbered-${index}`,
      ...project(point.lat, point.lng),
      label: String(index + 1),
      index
    }))
  }
  if (props.targetPoint) {
    const { x, y } = project(props.targetPoint.lat, props.targetPoint.lng)
    return [{ key: 'target', x, y, label: undefined as string | undefined, index: undefined as number | undefined }]
  }
  return []
})

const showSeatLabels = computed(() =>
  props.mode !== 'learn'
  && props.difficulty === 'lako'
  && !props.numberedPoints?.length
  && !props.targetPoint)
const showSettlementNames = computed(() => props.mode === 'learn')

/** The five municipalities' outlines; the one a question already narrows to is highlighted. */
const highlightedSlug = computed(() => {
  if (props.mode === 'learn' || !(props.singleTarget || props.mode === 'target') || !props.highlightId) return undefined
  const place = props.places.find(p => p.id === props.highlightId)
  return props.municipalities.find(m => m.id === place?.municipalityId)?.slug
})
const boundaries = computed(() =>
  Object.entries(MUNICIPALITY_BOUNDARIES).map(([slug, { d }]) => ({ slug, d, highlighted: slug === highlightedSlug.value })))
// Draw the highlighted outline last so it sits on top of its neighbours' edges.
const orderedBoundaries = computed(() => [...boundaries.value].sort((a, b) => Number(a.highlighted) - Number(b.highlighted)))

/**
 * Both basemaps are pale, in dark mode too, so the outlines have to be dark in both: the accented border
 * colour, pulled towards the text colour (light mode) or towards black (dark mode, where that colour is light).
 */
const mapColours = computed(() => dark.value
  ? {
      '--map-boundary': 'color-mix(in oklab, var(--ui-border-accented) 25%, #000)',
      '--map-highlight': 'color-mix(in oklab, var(--ui-primary) 40%, #000)'
    }
  : {
      '--map-boundary': 'color-mix(in oklab, var(--ui-border-accented) 35%, var(--ui-text-muted))',
      '--map-highlight': 'var(--ui-primary)'
    })

const legendUnits = computed(() => sortedMunicipalities(props.municipalities))

function dotStyle(place: PoolPlace) {
  const { x, y } = project(place.lat, place.lng)
  const fill = municipalityColor(place.municipalityId, props.municipalities, dark.value)
  const stroke = dark.value ? '#0a0a0a' : '#ffffff'
  return { cx: x, cy: y, fill, stroke }
}

function seatLabel(unit: PoolMunicipality) {
  const { x, y } = project(unit.lat, unit.lng)
  return { x, y, label: unit.label, fill: municipalityColor(unit.id, props.municipalities, dark.value) }
}

function clampTransform() {
  const el = viewport.value
  if (!el) return
  const vw = el.clientWidth
  const vh = el.clientHeight
  const sw = MAP_FRAME.width * scale.value
  const sh = MAP_FRAME.height * scale.value
  let x = translate.value.x
  let y = translate.value.y
  if (sw <= vw) x = (vw - sw) / 2
  else x = Math.min(0, Math.max(vw - sw, x))
  if (sh <= vh) y = (vh - sh) / 2
  else y = Math.min(0, Math.max(vh - sh, y))
  translate.value = { x, y }
}

function setScale(next: number, anchor?: { x: number, y: number }) {
  const el = viewport.value
  if (!el) return
  const clamped = Math.min(maxScale(), Math.max(fitScale(), next))
  if (anchor) {
    const ratio = clamped / scale.value
    translate.value = {
      x: anchor.x - ratio * (anchor.x - translate.value.x),
      y: anchor.y - ratio * (anchor.y - translate.value.y)
    }
  }
  scale.value = clamped
  clampTransform()
}

function zoomBy(factor: number) {
  const el = viewport.value
  if (!el) return
  touched = true
  gliding.value = false
  setScale(scale.value * factor, { x: el.clientWidth / 2, y: el.clientHeight / 2 })
}

/** Back to the default view: the whole area. */
function resetView() {
  scale.value = fitScale()
  translate.value = { x: 0, y: 0 }
  clampTransform()
}

/** Zoom so every given frame-space point is visible with padding, never closer than a settlement's surroundings. */
function fitPoints(points: { x: number, y: number }[]) {
  const el = viewport.value
  if (!el || !points.length) return
  const minX = Math.min(...points.map(p => p.x))
  const maxX = Math.max(...points.map(p => p.x))
  const minY = Math.min(...points.map(p => p.y))
  const maxY = Math.max(...points.map(p => p.y))
  const vw = el.clientWidth || MAP_FRAME.width * FALLBACK_SCALE
  const vh = el.clientHeight || MAP_FRAME.height * FALLBACK_SCALE
  const pad = 0.2
  const width = Math.max((maxX - minX) * (1 + pad * 2), MIN_FIT_SPAN)
  const height = Math.max((maxY - minY) * (1 + pad * 2), MIN_FIT_SPAN * vh / vw)
  const next = Math.min(maxScale(), Math.max(fitScale(), Math.min(vw / width, vh / height)))
  scale.value = next
  translate.value = {
    x: vw / 2 - (minX + maxX) / 2 * next,
    y: vh / 2 - (minY + maxY) / 2 * next
  }
  clampTransform()
}
/** Smallest stretch of map (frame pixels, about 3 km) a post-answer view shows, so two close points still sit in context. */
const MIN_FIT_SPAN = 420

function glideTo(move: () => void) {
  gliding.value = true
  move()
}

/** The one dot a question marks (null when it marks none, e.g. tap-anywhere or learn mode). */
const focusPoint = computed(() => {
  if (props.numberedPoints?.length) return null
  if (props.targetPoint) return project(props.targetPoint.lat, props.targetPoint.lng)
  if (props.mode === 'learn') return null
  if (props.singleTarget || props.mode === 'target') {
    const place = props.highlightId ? props.places.find(p => p.id === props.highlightId) : undefined
    return place ? project(place.lat, place.lng) : null
  }
  return null
})

/** A new question starts from the default view again. */
watch(() => focusPoint.value && `${focusPoint.value.x},${focusPoint.value.y}`, () => {
  touched = false
  resetView()
}, { flush: 'post' })

/** The player's answer: show the pick, the right place and the line between them. */
watch(() => props.feedback, (feedback) => {
  if (feedback) glideTo(() => fitPoints([feedback.tap, feedback.target]))
  else {
    touched = false
    resetView()
  }
}, { flush: 'post' })

/** Answered without a pick on the map (list or option answer): show the whole area again. */
watch(() => props.disabled, (disabled) => {
  if (disabled && !props.feedback) glideTo(resetView)
}, { flush: 'post' })

function screenToImage(clientX: number, clientY: number) {
  const el = viewport.value
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const x = (clientX - rect.left - translate.value.x) / scale.value
  const y = (clientY - rect.top - translate.value.y) / scale.value
  return { x, y }
}

function pickPlaceAt(imageX: number, imageY: number): PoolPlace | undefined {
  let best: PoolPlace | undefined
  let bestDistance = hitRadius.value
  for (const place of visibleDots.value) {
    const { x, y } = project(place.lat, place.lng)
    const distance = Math.hypot(imageX - x, imageY - y)
    if (distance <= bestDistance) {
      best = place
      bestDistance = distance
    }
  }
  return best
}

function pickNumberedAt(imageX: number, imageY: number): number | undefined {
  for (const marker of challengeMarkers.value) {
    if (marker.index === undefined) continue
    if (Math.hypot(imageX - marker.x, imageY - marker.y) <= hitRadius.value) return marker.index
  }
  return undefined
}

/**
 * Sizes are drawn in screen pixels whatever the zoom: a dot is 6px wide inside an invisible hit circle of
 * 44px, so `px(n)` turns n screen pixels into frame units.
 */
const px = (n: number) => n / scale.value
const hitRadius = computed(() => px(22))

/** Dots in reading order (top to bottom, then left to right) for the arrow keys. */
function readingOrder(places: PoolPlace[]) {
  return [...places].sort((a, b) => b.lat - a.lat || a.lng - b.lng)
}

function onDotKey(event: KeyboardEvent, place: PoolPlace) {
  if (props.disabled) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    pickFromList(place.id)
    return
  }
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (!step) return
  event.preventDefault()
  const dots = [...(viewport.value?.querySelectorAll<SVGElement>('[data-dot]') ?? [])]
  const at = dots.indexOf(event.currentTarget as SVGElement)
  dots[(at + step + dots.length) % dots.length]?.focus()
}

const pointers = new Map<number, { x: number, y: number }>()
let panStart: { x: number, y: number, tx: number, ty: number } | null = null
let pinchStart: { distance: number, scale: number } | null = null
let tapStart: { x: number, y: number } | null = null

function onPointerDown(event: PointerEvent) {
  if (props.disabled) return
  const el = viewport.value
  if (!el) return
  el.setPointerCapture(event.pointerId)
  touched = true
  gliding.value = false
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pointers.size === 1) {
    panStart = { x: event.clientX, y: event.clientY, tx: translate.value.x, ty: translate.value.y }
    tapStart = { x: event.clientX, y: event.clientY }
  } else if (pointers.size === 2) {
    panStart = null
    tapStart = null
    const pts = [...pointers.values()]
    pinchStart = { distance: Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y), scale: scale.value }
  }
}

function onPointerMove(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) return
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pointers.size === 2 && pinchStart) {
    const pts = [...pointers.values()]
    const dist = Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y)
    const mid = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 }
    const rect = viewport.value!.getBoundingClientRect()
    setScale(pinchStart.scale * (dist / pinchStart.distance), { x: mid.x - rect.left, y: mid.y - rect.top })
    return
  }
  if (panStart && pointers.size === 1) {
    translate.value = {
      x: panStart.tx + (event.clientX - panStart.x),
      y: panStart.ty + (event.clientY - panStart.y)
    }
    clampTransform()
  }
}

function onPointerUp(event: PointerEvent) {
  const start = tapStart
  pointers.delete(event.pointerId)
  if (pointers.size < 2) pinchStart = null
  if (pointers.size === 0) panStart = null
  if (props.disabled || !start || pointers.size > 0) return
  if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return
  const image = screenToImage(event.clientX, event.clientY)
  if (!image) return
  const numbered = pickNumberedAt(image.x, image.y)
  if (numbered !== undefined) {
    emit('selectIndex', numbered)
    return
  }
  const place = pickPlaceAt(image.x, image.y)
  const geo = unproject(image.x, image.y)
  emit('pick', { placeId: place?.id, lat: geo.lat, lng: geo.lng, imageX: image.x, imageY: image.y })
}

function onWheel(event: WheelEvent) {
  if (!event.ctrlKey && Math.abs(event.deltaY) < 20) return
  event.preventDefault()
  zoomBy(event.deltaY < 0 ? 1.25 : 0.8)
}

function pickFromList(placeId: string) {
  const place = props.places.find(p => p.id === placeId)
  if (!place) return
  const { x, y } = project(place.lat, place.lng)
  emit('pick', { placeId: place.id, lat: place.lat, lng: place.lng, imageX: x, imageY: y })
}

onMounted(() => {
  resetView()
  const el = viewport.value
  if (!el) return
  const observer = new ResizeObserver(() => {
    if (touched) {
      scale.value = Math.min(maxScale(), Math.max(fitScale(), scale.value))
      clampTransform()
    } else resetView()
  })
  observer.observe(el)
  onUnmounted(() => observer.disconnect())
})

defineExpose({ screenToImage, pickFromList, projectPlace: (place: PoolPlace) => project(place.lat, place.lng) })
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-2"
    data-testid="map-view"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div
        v-if="!layerLocked"
        role="radiogroup"
        :aria-label="t('pz.map.layers')"
        class="inline-flex flex-wrap gap-1 rounded-full border border-accented bg-muted p-1"
      >
        <button
          v-for="layer in availableLayers"
          :key="layer.id"
          type="button"
          role="radio"
          :aria-checked="layerId === layer.id"
          class="min-h-(--pz-tap-min) rounded-full px-3 text-sm font-semibold transition-colors motion-reduce:transition-none"
          :class="layerId === layer.id ? 'bg-default text-default ring-1 ring-(--ui-border-accented)' : 'text-muted hover:text-highlighted'"
          :data-testid="`map-layer-${layer.id}`"
          @click="layerId = layer.id"
        >
          {{ t(`pz.map.${layer.id}`) }}
        </button>
      </div>
      <div class="flex gap-1 print:hidden">
        <UButton
          :aria-label="t('pz.map.zoomIn')"
          icon="i-lucide-plus"
          size="lg"
          color="neutral"
          variant="outline"
          class="size-(--pz-tap-min) justify-center"
          data-testid="map-zoom-in"
          @click="zoomBy(1.5)"
        />
        <UButton
          :aria-label="t('pz.map.zoomOut')"
          icon="i-lucide-minus"
          size="lg"
          color="neutral"
          variant="outline"
          class="size-(--pz-tap-min) justify-center"
          data-testid="map-zoom-out"
          @click="zoomBy(1 / 1.5)"
        />
      </div>
    </div>

    <div
      ref="viewport"
      class="relative aspect-[1600/1373] w-full touch-none overflow-hidden rounded-(--pz-radius-lg) border border-accented bg-muted"
      data-testid="map-viewport"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel="onWheel"
    >
      <div
        class="absolute left-0 top-0 origin-top-left will-change-transform"
        :class="gliding ? 'transition-transform duration-500 ease-out motion-reduce:transition-none' : ''"
        data-testid="map-surface"
        :style="{ width: `${MAP_FRAME.width}px`, height: `${MAP_FRAME.height}px`, transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})` }"
        @transitionend="gliding = false"
      >
        <img
          :src="activeLayer.src"
          :width="MAP_FRAME.width"
          :height="MAP_FRAME.height"
          alt=""
          class="block max-w-none select-none"
          draggable="false"
        >
        <svg
          class="pointer-events-none absolute inset-0 h-full w-full"
          :viewBox="`0 0 ${MAP_FRAME.width} ${MAP_FRAME.height}`"
          role="group"
          :aria-label="t('pz.map.layers')"
          :style="mapColours"
        >
          <!-- Municipality boundaries: decorative context, never in the way of a tap. -->
          <g
            aria-hidden="true"
            class="pointer-events-none"
            data-testid="map-boundaries"
          >
            <path
              v-for="boundary in orderedBoundaries"
              :key="boundary.slug"
              :d="boundary.d"
              :data-municipality="boundary.slug"
              :data-highlighted="boundary.highlighted ? 'true' : undefined"
              stroke-linejoin="round"
              :fill="boundary.highlighted ? 'var(--map-highlight)' : 'none'"
              :fill-opacity="boundary.highlighted ? 0.14 : undefined"
              :stroke="boundary.highlighted ? 'var(--map-highlight)' : 'var(--map-boundary)'"
              :stroke-width="px(boundary.highlighted ? 3 : 1.75)"
              :stroke-dasharray="boundary.highlighted ? undefined : `${px(7)} ${px(4)}`"
            />
          </g>
          <g v-if="feedback">
            <!-- A miss: the right place in teal with a check, the pick in brick, a dashed line between them. -->
            <line
              :x1="feedback.tap.x"
              :y1="feedback.tap.y"
              :x2="feedback.target.x"
              :y2="feedback.target.y"
              stroke="var(--ui-error)"
              :stroke-width="px(2)"
              :stroke-dasharray="`${px(4)} ${px(4)}`"
              data-testid="map-feedback-line"
            />
            <circle
              :cx="feedback.tap.x"
              :cy="feedback.tap.y"
              :r="px(7)"
              fill="var(--ui-error)"
              stroke="var(--ui-bg)"
              :stroke-width="px(2)"
            />
            <circle
              :cx="feedback.target.x"
              :cy="feedback.target.y"
              :r="px(14)"
              fill="none"
              stroke="var(--ui-success)"
              :stroke-width="px(3)"
            />
            <text
              :x="feedback.target.x"
              :y="feedback.target.y - px(20)"
              text-anchor="middle"
              class="fill-current font-semibold text-highlighted"
              :style="{ fontSize: `${px(12)}px` }"
              stroke="var(--ui-bg)"
              :stroke-width="px(4)"
              paint-order="stroke fill"
            >
              ✓ {{ t('pz.play.mapHit') }}
            </text>
          </g>
          <g
            v-for="place in readingOrder(visibleDots)"
            :key="place.id"
          >
            <circle
              :cx="dotStyle(place).cx"
              :cy="dotStyle(place).cy"
              :r="hitRadius"
              fill="transparent"
              class="pointer-events-auto cursor-pointer outline-none focus-visible:stroke-(--focus-ring) focus-visible:stroke-[3px]"
              role="button"
              tabindex="0"
              data-dot
              :aria-label="place.name"
              :aria-disabled="disabled ? 'true' : undefined"
              :data-testid="`map-dot-${place.id}`"
              @keydown="onDotKey($event, place)"
            />
            <circle
              :cx="dotStyle(place).cx"
              :cy="dotStyle(place).cy"
              :r="px(3.5)"
              :fill="dotStyle(place).fill"
              :stroke="dotStyle(place).stroke"
              :stroke-width="px(1.5)"
              class="pointer-events-none"
            />
            <text
              v-if="showSettlementNames"
              :x="dotStyle(place).cx"
              :y="dotStyle(place).cy - px(10)"
              text-anchor="middle"
              class="pointer-events-none fill-current text-highlighted font-semibold"
              :style="{ fontSize: `${px(11)}px` }"
              stroke="var(--ui-bg)"
              :stroke-width="px(3)"
              paint-order="stroke fill"
            >
              {{ place.name }}
            </text>
          </g>
          <g
            v-for="marker in challengeMarkers"
            :key="marker.key"
          >
            <circle
              :cx="marker.x"
              :cy="marker.y"
              :r="hitRadius"
              fill="transparent"
              class="pointer-events-auto cursor-pointer"
              :data-testid="marker.index === undefined ? 'map-challenge-target' : `map-numbered-${marker.index + 1}`"
            />
            <circle
              :cx="marker.x"
              :cy="marker.y"
              :r="px(5)"
              fill="var(--ui-primary)"
              stroke="var(--ui-bg)"
              :stroke-width="px(1.5)"
              class="pointer-events-none"
            />
            <text
              v-if="marker.label"
              :x="marker.x"
              :y="marker.y + px(4)"
              text-anchor="middle"
              class="pointer-events-none fill-inverted font-bold"
              :style="{ fontSize: `${px(10)}px` }"
            >
              {{ marker.label }}
            </text>
          </g>
          <g v-if="showSeatLabels">
            <text
              v-for="seat in legendUnits.map(seatLabel)"
              :key="seat.label"
              :x="seat.x"
              :y="seat.y - px(12)"
              text-anchor="middle"
              class="fill-current text-highlighted font-bold"
              :style="{ fontSize: `${px(12)}px` }"
              stroke="var(--ui-bg)"
              :stroke-width="px(3)"
              paint-order="stroke fill"
            >
              {{ seat.label }}
            </text>
          </g>
        </svg>
      </div>
    </div>

    <p class="text-[10px] leading-snug text-muted">
      {{ activeLayer.attribution }}
    </p>

    <ul
      v-if="mode === 'learn'"
      class="flex flex-wrap gap-2 text-xs"
      aria-label="Legenda"
    >
      <li
        v-for="unit in legendUnits"
        :key="unit.id"
        class="inline-flex items-center gap-1"
      >
        <span
          class="inline-block size-2.5 rounded-full"
          :style="{ background: municipalityColor(unit.id, municipalities, dark) }"
        />
        {{ unit.label }}
      </li>
    </ul>

    <details
      v-if="mode !== 'learn' && difficulty !== 'tesko' && !numberedPoints?.length && !targetPoint"
      class="rounded-(--pz-radius-md) border border-accented bg-default"
    >
      <summary class="flex min-h-(--pz-tap-min) cursor-pointer items-center gap-2 px-3 text-sm font-semibold text-default">
        <UIcon
          name="i-lucide-list"
          class="size-5 shrink-0"
        />
        {{ t('pz.play.chooseFromList') }}
      </summary>
      <ul class="m-0 flex max-h-72 list-none flex-col gap-2 overflow-y-auto p-3 pt-1">
        <li
          v-for="place in sortedPlaces"
          :key="place.id"
        >
          <button
            type="button"
            class="flex min-h-(--pz-option-min) w-full items-center gap-2 rounded-(--pz-radius-md) border border-accented bg-default px-4 py-3 text-start text-base text-default hover:bg-muted aria-disabled:cursor-default aria-disabled:border-default aria-disabled:bg-muted aria-disabled:text-muted"
            :aria-disabled="disabled ? 'true' : undefined"
            :data-testid="`map-list-${place.id}`"
            @click="!disabled && pickFromList(place.id)"
          >
            <UIcon
              name="i-lucide-map-pin"
              class="size-5 shrink-0 text-dimmed"
            />
            {{ place.name }}
          </button>
        </li>
      </ul>
    </details>
    <p
      v-else-if="mode === 'find' && difficulty === 'tesko'"
      class="text-sm text-muted"
    >
      {{ t('pz.map.hardNeedsMap') }}
    </p>
  </div>
</template>
