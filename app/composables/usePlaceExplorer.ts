import type { AtlasMunicipalityResponse, AtlasOverviewResponse, AtlasSettlementIndexResponse } from '~~/shared/types/publicAtlas'
import type { PzPlaceCard } from '~/components/pz/PzPlaceExplorer.vue'

type OverviewMunicipality = AtlasOverviewResponse['municipalities'][number]
type MunicipalitySettlement = AtlasMunicipalityResponse['settlements'][number]
type IndexSettlement = AtlasSettlementIndexResponse['settlements'][number]

/** Search shows at most this many settlements; one more letter narrows the rest. */
const MAX_SETTLEMENT_MATCHES = 30

/** The cards of the place explorer (PzPlaceExplorer): a town or municipality, or a settlement. */
export function usePlaceCards() {
  const { t } = useI18n()
  const localePath = useLocalePath()
  const { municipalityPath } = useAtlas()

  /** "2 zapisa", or "još bez zapisa" for a settlement nothing has been recorded in yet. */
  const records = (n: number) => n ? countNoun(n, 'zapis', 'zapisa') : t('pz.explore.settlementNoRecords')

  function municipalityCard(m: OverviewMunicipality): PzPlaceCard {
    return {
      id: m.id,
      title: m.label,
      meta: `${countNoun(m.stats.settlements, 'naselje', 'naselja')} · ${countNoun(m.stats.items, 'zapis', 'zapisa')}`,
      to: municipalityPath(m.slug),
      area: m.slug
    }
  }

  /** A settlement; with `unit`, the town or municipality it belongs to leads the meta line (region-wide search). */
  function settlementCard(s: MunicipalitySettlement | IndexSettlement, area: string, unit?: string): PzPlaceCard {
    return {
      id: s.id,
      title: s.name,
      meta: unit ? `${unit} · ${records(s.itemCount)}` : records(s.itemCount),
      to: localePath(s.path),
      area,
      point: s.centroid,
      quiet: !s.itemCount
    }
  }

  return { municipalityCard, settlementCard }
}

/** Names that start with the query first, then the others, each in dictionary order. */
export function matchPlaces<T>(items: T[], query: string, name: (item: T) => string): T[] {
  const q = foldHr(query.trim())
  if (!q) return items
  return items
    .map(item => ({ item, folded: foldHr(name(item)) }))
    .filter(({ folded }) => folded.includes(q))
    .sort((a, b) => Number(!a.folded.startsWith(q)) - Number(!b.folded.startsWith(q)) || compareHr(name(a.item), name(b.item)))
    .map(({ item }) => item)
}

/**
 * The region-wide explorer (Početna, Mjesta): the towns and municipalities as cards and, once the visitor types, the
 * units and settlements whose names match. The settlement index loads on the first search, in the browser, so the
 * pages render without it.
 */
export function useRegionExplorer(overview: MaybeRefOrGetter<AtlasOverviewResponse | null | undefined>) {
  const { municipalityPath } = useAtlas()
  const { municipalityCard, settlementCard } = usePlaceCards()
  const query = ref('')

  const { data: index, status, execute } = useFetch<AtlasSettlementIndexResponse>('/api/atlas/settlements', {
    key: 'pz-settlement-index',
    server: false,
    immediate: false,
    lazy: true
  })
  watch(query, (value) => {
    if (value.trim() && status.value === 'idle') execute()
  })

  const municipalities = computed(() => toValue(overview)?.municipalities ?? [])
  const areas = computed(() => municipalities.value.map(m => ({ slug: m.slug, name: m.name, to: municipalityPath(m.slug) })))

  const cards = computed<PzPlaceCard[]>(() => {
    const units = matchPlaces(municipalities.value, query.value, m => m.label).map(municipalityCard)
    if (!query.value.trim()) return units
    const settlements = matchPlaces(index.value?.settlements ?? [], query.value, s => s.name)
      .slice(0, MAX_SETTLEMENT_MATCHES)
      .map(s => settlementCard(s, s.municipality.slug, s.municipality.label))
    return [...units, ...settlements]
  })

  /** The settlement index is still on its way for the current query. */
  const loading = computed(() => !!query.value.trim() && (status.value === 'idle' || status.value === 'pending'))

  return { query, areas, cards, loading }
}
