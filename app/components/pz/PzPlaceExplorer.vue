<script setup lang="ts">
// Place explorer, the "Karta i popis" pattern of the place pages (Početna, Mjesta, a town or municipality): the area
// map on the left and, on the right, a search field over a list of place cards that scrolls inside a column exactly as
// tall as the map. On a phone the map comes first and the list follows in the page's own scroll, never a scroll inside
// the page. The page owns the data and the filtering (v-model:query); the explorer pairs the two views: pointing at or
// focusing a card outlines its area or lifts its point on the map, and pointing at an area or a point marks its card.
// Every card is one link, so the list alone reaches every place. A long list (`collapseAfter`) shows its first cards on a
// phone and a button for the rest, so what follows the explorer stays near; a search always lists every match. A card with a point (a settlement) gets a dot on the
// map and a pin in the list; an area card (a town or municipality) shows its map fill as a swatch.
import type { PzAreaMapArea } from './PzAreaMap.vue'

export interface PzPlaceCard {
  id: string
  title: string
  /** One line under the title: counts, or the unit a settlement belongs to. */
  meta?: string
  to: string
  /** Town or municipality slug: the card's area on the map. */
  area?: string
  /** Where a settlement sits: the map shows a point for it. */
  point?: { lat: number, lng: number } | null
  /** Quieter meta line, for a settlement with no records yet. */
  quiet?: boolean
}

const props = defineProps<{
  areas: PzAreaMapArea[]
  cards: PzPlaceCard[]
  /** Zoom the map to this area (a town or municipality page). */
  selected?: string
  mapLabel: string
  searchLabel: string
  searchPlaceholder?: string
  /** Accessible name of the card list. */
  listLabel: string
  listTestid?: string
  /** Said when no card matches the query (or put your own in the `empty` slot). */
  emptyText?: string
  /** The cards for the query are still loading: say `loadingText` instead of "nothing found". */
  loading?: boolean
  loadingText?: string
  /** On a phone, list this many cards and a `showAllLabel` button for the rest (not while searching). */
  collapseAfter?: number
  showAllLabel?: string
}>()

const query = defineModel<string>('query', { default: '' })

/** What the map marks: an area slug or a point id, from the card or the map under the pointer or focus. */
const marked = ref<string>()
const mapId = (card: PzPlaceCard) => card.point ? card.id : card.area

const points = computed(() => props.cards.flatMap(card => card.point
  ? [{ id: card.id, lat: card.point.lat, lng: card.point.lng, name: card.title, to: card.to }]
  : []))

const searching = computed(() => !!query.value.trim())

const list = useTemplateRef<HTMLUListElement>('list')
const expanded = ref(false)
const collapsed = computed(() => !!props.collapseAfter && !expanded.value && !searching.value && props.cards.length > props.collapseAfter)

async function showAll() {
  const first = props.collapseAfter ?? 0
  expanded.value = true
  await nextTick()
  list.value?.querySelectorAll<HTMLAnchorElement>('li a')[first]?.focus()
}
</script>

<template>
  <div
    class="grid gap-4 lg:grid-cols-12 lg:gap-8"
    data-testid="place-explorer"
  >
    <div class="min-w-0 lg:col-span-7">
      <PzAreaMap
        :areas="areas"
        :selected="selected"
        :active="marked"
        :points="points"
        :label="mapLabel"
        @hover="marked = $event"
      />
    </div>
    <div class="relative min-w-0 lg:col-span-5">
      <div class="flex flex-col gap-3 lg:absolute lg:inset-0">
        <PzSearchField
          v-model="query"
          :label="searchLabel"
          :placeholder="searchPlaceholder ?? searchLabel"
          :suggestion-count="searching ? cards.length : undefined"
        />
        <ul
          v-if="cards.length"
          ref="list"
          :aria-label="listLabel"
          class="flex flex-col gap-2 lg:-mx-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:px-2 lg:py-1"
          :data-testid="listTestid ?? 'place-cards'"
        >
          <li
            v-for="(card, index) in cards"
            :key="card.id"
            :data-card="card.id"
            :class="collapsed && index >= (collapseAfter ?? 0) && 'max-lg:hidden'"
          >
            <NuxtLink
              :to="card.to"
              class="flex min-h-(--pz-tap-min) items-center gap-3 rounded-md border px-3.5 py-2.5 text-default no-underline"
              :class="marked && marked === mapId(card)
                ? 'border-accented bg-muted'
                : 'border-default bg-default hover:border-accented hover:bg-muted'"
              :data-marked="marked && marked === mapId(card) ? 'true' : undefined"
              @pointerenter="marked = mapId(card)"
              @pointerleave="marked = undefined"
              @focus="marked = mapId(card)"
              @blur="marked = undefined"
            >
              <UIcon
                v-if="card.point !== undefined"
                name="i-lucide-map-pin"
                class="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span
                v-else-if="card.area"
                class="size-4 shrink-0 rounded-(--pz-radius-xs) border border-accented"
                :style="{ background: AREA_MAP_STYLE[card.area]?.fill ?? 'var(--ui-bg-elevated)' }"
                aria-hidden="true"
              />
              <span class="flex min-w-0 flex-1 flex-col">
                <b class="pz-label wrap-anywhere text-highlighted">{{ card.title }}</b>
                <small
                  v-if="card.meta"
                  class="pz-caption font-normal tabular-nums"
                  :class="card.quiet ? 'text-dimmed' : 'text-muted'"
                >{{ card.meta }}</small>
              </span>
              <UIcon
                name="i-lucide-chevron-right"
                class="size-5 shrink-0 text-dimmed"
                aria-hidden="true"
              />
            </NuxtLink>
          </li>
        </ul>
        <p
          v-else-if="loading"
          class="pz-body-sm text-muted"
          data-testid="place-cards-loading"
        >
          {{ loadingText }}
        </p>
        <div
          v-else
          data-testid="place-cards-empty"
        >
          <slot name="empty">
            <p class="pz-body-sm text-muted">
              {{ emptyText }}
            </p>
          </slot>
        </div>
        <UButton
          v-if="collapsed"
          :label="showAllLabel"
          color="neutral"
          variant="outline"
          icon="i-lucide-chevrons-down"
          class="self-start ring-(--ui-border-accented) lg:hidden"
          data-testid="place-cards-show-all"
          @click="showAll"
        />
      </div>
    </div>
  </div>
</template>
