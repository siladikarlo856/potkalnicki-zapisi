<script setup lang="ts">
import { MAP_FRAME, MAP_LAYERS, project, unproject, type MapLayerId } from '~~/shared/utils/games/mapFrame'
import { municipalityColor, sortedMunicipalities } from '~~/shared/utils/games/mapUnits'
import type { Difficulty } from '~~/shared/utils/games/types'
import type { PoolMunicipality, PoolPlace } from '~~/shared/utils/learn/types'

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
/** Default and minimum zoom: opens a little zoomed out so more of the surroundings show. */
const MIN_SCALE = 0.75
const scale = ref(MIN_SCALE)
const translate = ref({ x: 0, y: 0 })

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
  const clamped = Math.min(4, Math.max(MIN_SCALE, next))
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

function zoomBy(delta: number) {
  const el = viewport.value
  if (!el) return
  setScale(scale.value + delta, { x: el.clientWidth / 2, y: el.clientHeight / 2 })
}

/** Centre a frame-space point in the viewport at the current zoom (clamped to the map bounds). */
function centreOn(point: { x: number, y: number }) {
  const el = viewport.value
  if (!el) return
  translate.value = {
    x: el.clientWidth / 2 - point.x * scale.value,
    y: el.clientHeight / 2 - point.y * scale.value
  }
  clampTransform()
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

watch(focusPoint, (point) => {
  if (point) centreOn(point)
  else {
    translate.value = { x: 0, y: 0 }
    clampTransform()
  }
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
  for (const place of visibleDots.value) {
    const { x, y } = project(place.lat, place.lng)
    if (Math.hypot(imageX - x, imageY - y) <= HIT_RADIUS) return place
  }
  return undefined
}

function pickNumberedAt(imageX: number, imageY: number): number | undefined {
  for (const marker of challengeMarkers.value) {
    if (marker.index === undefined) continue
    if (Math.hypot(imageX - marker.x, imageY - marker.y) <= HIT_RADIUS) return marker.index
  }
  return undefined
}

/** A dot is 6px wide inside an invisible hit circle of 44px (in frame units, before the viewport's zoom). */
const HIT_RADIUS = 22

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
  zoomBy(event.deltaY < 0 ? 0.25 : -0.25)
}

function pickFromList(placeId: string) {
  const place = props.places.find(p => p.id === placeId)
  if (!place) return
  const { x, y } = project(place.lat, place.lng)
  emit('pick', { placeId: place.id, lat: place.lat, lng: place.lng, imageX: x, imageY: y })
}

onMounted(() => {
  clampTransform()
  if (focusPoint.value) centreOn(focusPoint.value)
  const el = viewport.value
  if (!el) return
  const observer = new ResizeObserver(() => clampTransform())
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
          class="min-h-10 rounded-full px-3 text-sm font-semibold transition-colors motion-reduce:transition-none"
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
          @click="zoomBy(0.5)"
        />
        <UButton
          :aria-label="t('pz.map.zoomOut')"
          icon="i-lucide-minus"
          size="lg"
          color="neutral"
          variant="outline"
          class="size-(--pz-tap-min) justify-center"
          data-testid="map-zoom-out"
          @click="zoomBy(-0.5)"
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
        :style="{ width: `${MAP_FRAME.width}px`, height: `${MAP_FRAME.height}px`, transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})` }"
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
        >
          <g v-if="feedback">
            <!-- A miss: the right place in teal with a check, the pick in brick, a dashed line between them. -->
            <line
              :x1="feedback.tap.x"
              :y1="feedback.tap.y"
              :x2="feedback.target.x"
              :y2="feedback.target.y"
              stroke="var(--ui-error)"
              stroke-width="2"
              stroke-dasharray="4 4"
            />
            <circle
              :cx="feedback.tap.x"
              :cy="feedback.tap.y"
              r="7"
              fill="var(--ui-error)"
              stroke="var(--ui-bg)"
              stroke-width="2"
            />
            <circle
              :cx="feedback.target.x"
              :cy="feedback.target.y"
              r="14"
              fill="none"
              stroke="var(--ui-success)"
              stroke-width="3"
            />
            <text
              :x="feedback.target.x"
              :y="feedback.target.y - 20"
              text-anchor="middle"
              class="fill-current text-[12px] font-semibold text-highlighted"
              stroke="var(--ui-bg)"
              stroke-width="4"
              paint-order="stroke fill"
            >
              ✓ {{ t('pz.map.mapHit') }}
            </text>
          </g>
          <g
            v-for="place in readingOrder(visibleDots)"
            :key="place.id"
          >
            <circle
              :cx="dotStyle(place).cx"
              :cy="dotStyle(place).cy"
              :r="HIT_RADIUS"
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
              r="4"
              :fill="dotStyle(place).fill"
              :stroke="dotStyle(place).stroke"
              stroke-width="1.5"
              class="pointer-events-none"
            />
            <text
              v-if="showSettlementNames"
              :x="dotStyle(place).cx"
              :y="dotStyle(place).cy - 10"
              text-anchor="middle"
              class="pointer-events-none fill-current text-highlighted text-[11px] font-semibold"
              stroke="var(--ui-bg)"
              stroke-width="3"
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
              r="22"
              fill="transparent"
              class="pointer-events-auto cursor-pointer"
              :data-testid="marker.index === undefined ? 'map-challenge-target' : `map-numbered-${marker.index + 1}`"
            />
            <circle
              :cx="marker.x"
              :cy="marker.y"
              r="5"
              fill="var(--ui-primary)"
              stroke="var(--ui-bg)"
              stroke-width="1.5"
              class="pointer-events-none"
            />
            <text
              v-if="marker.label"
              :x="marker.x"
              :y="marker.y + 4"
              text-anchor="middle"
              class="pointer-events-none fill-inverted text-[10px] font-bold"
            >
              {{ marker.label }}
            </text>
          </g>
          <g v-if="showSeatLabels">
            <text
              v-for="seat in legendUnits.map(seatLabel)"
              :key="seat.label"
              :x="seat.x"
              :y="seat.y - 12"
              text-anchor="middle"
              class="fill-current text-highlighted text-xs font-bold"
              stroke="var(--ui-bg)"
              stroke-width="3"
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
