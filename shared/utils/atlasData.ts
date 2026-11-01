import type { AtlasBundle, AtlasHeritageItem, AtlasMunicipality, AtlasSettlement, AtlasSource } from '../types/atlas'
import municipalities from '../../content/atlas/municipalities.json'
import settlements from '../../content/atlas/settlements.json'
import sources from '../../content/atlas/sources.json'
import heritage from '../../content/atlas/heritage.json'
import prerenderRoutes from '../../content/atlas/prerender-routes.json'

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

export const HERITAGE_CATEGORY_LABELS: Record<string, string> = {
  'church': 'Crkva',
  'cathedral': 'Katedrala',
  'chapel': 'Kapela',
  'chapel-shrine': 'Kapela / svetište',
  'wayside-shrine': 'Kapelica / poklonac',
  'cross': 'Križ',
  'statue': 'Kip',
  'monastery': 'Samostan',
  'archaeological-site': 'Arheološki lokalitet',
  'historical-site': 'Povijesni lokalitet'
}

export function categoryLabel(category: string) {
  return HERITAGE_CATEGORY_LABELS[category] ?? category
}
