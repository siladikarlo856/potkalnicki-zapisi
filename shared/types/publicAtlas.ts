import type { AtlasItemStatus } from './atlas'

// Response shapes of the public atlas API (/api/atlas/*, /api/content/target). Ids are content UUIDs; paths
// are canonical, unlocalized site paths (pass them through localePath). Only published rows appear.

export type PublicMunicipalityKind = 'town' | 'municipality'

export interface PublicCategoryRef {
  key: string
  label: string
}

export interface PublicMunicipalityRef {
  id: string
  slug: string
  /** Bare place name, e.g. "Križevci" */
  name: string
  /** Display label from kind and name, e.g. "Grad Križevci", "Općina Kalnik" */
  label: string
  kind: PublicMunicipalityKind
  path: string
}

export interface PublicSettlementRef {
  id: string
  slug: string
  name: string
  /** DGU settlement code */
  code: string | null
  path: string
}

export interface PublicPlaceStats {
  settlements: number
  items: number
  settlementsWithItems: number
}

export interface PublicHeritageListItem {
  id: string
  slug: string
  name: string
  category: PublicCategoryRef
  municipality: Pick<PublicMunicipalityRef, 'id' | 'slug' | 'label'>
  settlement: Pick<PublicSettlementRef, 'id' | 'slug' | 'name'> | null
  locality: string | null
  verification: AtlasItemStatus
  noindex: boolean
  /** Item page path; null when the item has no settlement yet */
  path: string | null
}

export interface PublicCredit {
  name: string
  kind?: string
}

export interface PublicSource {
  id: string
  title: string
  type: string
  url: string | null
}

export interface PublicHeritageItem extends PublicHeritageListItem {
  /**
   * Stable id for correction submissions (`target_ref`): the old item id for imported items
   * (`krizevci-crkva-sv-ane`), the UUID for items created later.
   */
  ref: string
  heritageStatus: string | null
  registryNumber: string | null
  period: string | null
  description: string | null
  researchNotes: string
  coordinates: { lat: number, lng: number } | null
  credits: PublicCredit[]
  sources: PublicSource[]
  updatedAt: string
}

export interface AtlasOverviewResponse {
  region: { id: string, slug: string, name: string }
  totals: PublicPlaceStats & { municipalities: number }
  municipalities: Array<PublicMunicipalityRef & { stats: PublicPlaceStats }>
}

export interface AtlasMunicipalityResponse {
  municipality: PublicMunicipalityRef
  stats: PublicPlaceStats
  settlements: Array<PublicSettlementRef & { itemCount: number }>
  categories: Array<PublicCategoryRef & { count: number }>
}

export interface AtlasSettlementResponse {
  settlement: PublicSettlementRef & {
    centroid: { lat: number, lng: number } | null
    /** Consenting named contributors ("Zahvaljujemo") and the last edit date ("Zadnja izmjena") */
    credits: PublicCredit[]
    updatedAt: string
  }
  municipality: PublicMunicipalityRef
  items: PublicHeritageListItem[]
}

export interface AtlasHeritageListResponse {
  items: PublicHeritageListItem[]
  /** Filter options: categories (with counts) and municipalities that have items in the full list */
  categories: Array<PublicCategoryRef & { count: number }>
  municipalities: Array<Pick<PublicMunicipalityRef, 'slug' | 'label'>>
  total: number
}

export interface AtlasHeritageItemResponse {
  item: PublicHeritageItem
}

/** Answer for an old URL (slug history): the page should redirect with 301 to `redirect`. */
export interface AtlasRedirectResponse {
  redirect: string
}

export interface PublicAreaTarget {
  id: string
  slug: string
  name: string
  /** "Grad Križevci" for a town or municipality, the name for a settlement */
  label: string
  areaKind: PublicMunicipalityKind | 'settlement'
  path: string
}

/** GET /api/content/target: what a correction or suggestion form points at. */
export type ContentTargetResponse
  = | { kind: 'heritage_item', item: PublicHeritageListItem & { ref: string } }
    | { kind: 'area', area: PublicAreaTarget }
    | { kind: 'source', source: PublicSource }

/** GET /api/content/suggest-options: the published rows a suggestion form picks from (ids are content UUIDs). */
export interface SuggestOptionsResponse {
  categories: Array<{ id: string, key: string, label: string }>
  municipalities: Array<{ id: string, slug: string, label: string }>
  settlements: Array<{ id: string, slug: string, name: string, municipalityId: string }>
}

/** GET /api/content/search?q=: what the "Ispravak" card offers to correct (words are searched in the browser). */
export interface ContentSearchResponse {
  items: Array<{ id: string, name: string, context: string }>
  settlements: Array<{ id: string, name: string, context: string }>
}
