import type { AtlasItemStatus } from '../../shared/types/atlas'
import municipalities from '../fixtures/atlas/municipalities.json'
import settlements from '../fixtures/atlas/settlements.json'
import sources from '../fixtures/atlas/sources.json'
import heritage from '../fixtures/atlas/heritage.json'
import prerenderRoutes from '../fixtures/atlas/prerender-routes.json'

export interface AtlasMunicipality {
  id: string
  slug: string
  name: string
  /** Municipality label as in server/data/places/hr.json */
  catalogName: string
}

export interface AtlasSettlement {
  /** DGU official settlement code */
  id: string
  slug: string
  name: string
  municipalityId: string
  centroid: { lat: number, lng: number } | null
}

export interface AtlasSource {
  id: string
  title: string
  type: string
  url: string | null
}

export interface AtlasHeritageItem {
  id: string
  legacyId: string
  slug: string
  name: string
  category: string
  municipalityId: string
  /** DGU code; null when settlement could not be matched safely */
  settlementCode: string | null
  locality?: string
  sourceIds: string[]
  status: AtlasItemStatus
  researchNotes: string
  /** Standalone item page should carry noindex until described */
  noindex: boolean
}

export interface AtlasBundle {
  municipalities: AtlasMunicipality[]
  settlements: AtlasSettlement[]
  sources: AtlasSource[]
  heritage: AtlasHeritageItem[]
}

/** The atlas as it was imported into the database (frozen test fixtures; the content itself lives in the database). */
export const atlasPrerenderRoutes = prerenderRoutes as string[]

let cached: AtlasBundle | undefined

export function getAtlas(): AtlasBundle {
  if (!cached) {
    cached = {
      municipalities: municipalities as AtlasMunicipality[],
      settlements: settlements as AtlasSettlement[],
      sources: sources as AtlasSource[],
      heritage: heritage as AtlasHeritageItem[]
    }
  }
  return cached
}

export function municipalityBySlug(slug: string) {
  return getAtlas().municipalities.find(m => m.slug === slug)
}

export function settlementBySlug(slug: string) {
  return getAtlas().settlements.find(s => s.slug === slug)
}

export function settlementByCode(code: string) {
  return getAtlas().settlements.find(s => s.id === code)
}

export function heritageForSettlement(code: string) {
  return getAtlas().heritage.filter(item => item.settlementCode === code)
}

export function heritageItemByRoute(settlementSlug: string, itemSlug: string) {
  const settlement = settlementBySlug(settlementSlug)
  if (!settlement) return undefined
  return getAtlas().heritage.find(
    item => item.settlementCode === settlement.id && item.slug === itemSlug
  )
}

export function heritageItemById(id: string) {
  return getAtlas().heritage.find(item => item.id === id)
}

export function municipalityStats(municipalityId: AtlasMunicipality['id']) {
  const atlas = getAtlas()
  const settlements = atlas.settlements.filter(s => s.municipalityId === municipalityId)
  const items = atlas.heritage.filter(h => h.municipalityId === municipalityId)
  const withItems = new Set(items.filter(i => i.settlementCode).map(i => i.settlementCode))
  return {
    settlements: settlements.length,
    items: items.length,
    settlementsWithItems: withItems.size
  }
}
