import type { AtlasItemStatus } from './atlas'
import type { PublicIntangibleRef } from './publicIntangible'

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

/**
 * A photo with the credit every reuse needs (TASL: title/alt, author, source, licence). URLs point at the public
 * Storage bucket; `width` and `height` are the large copy's, so they also give the thumbnail's aspect ratio.
 */
export interface PublicImage {
  url: string
  thumbUrl: string
  width: number
  height: number
  alt: string
  caption: string | null
  author: string
  authorUrl: string | null
  sourceUrl: string | null
  /** Licence code, e.g. "cc-by-sa-4.0"; "permission" for a photo used with the author's permission */
  license: string
  /** "CC BY-SA 4.0", "Javno dobro", "Uz dopuštenje autora" */
  licenseLabel: string
  /** The licence deed; null for "permission" */
  licenseUrl: string | null
}

/** The main photo as a card shows it, with what its one-line credit needs ("Autor, CC BY-SA 4.0"). */
export type PublicImageThumb = Pick<PublicImage, 'width' | 'height' | 'alt' | 'author' | 'licenseLabel'> & { url: string }

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
  /** The main photo; null when the item has none */
  thumb: PublicImageThumb | null
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

/** A person as listed on place and item pages. `years` is "1588–1619"; `path` the person page. */
export interface PublicPersonRef {
  id: string
  slug: string
  name: string
  years: string
  role: string
  path: string
}

export interface PublicPersonListItem extends PublicPersonRef {
  /** The first linked place (settlement name or "Grad Križevci"); null never happens for a live person */
  place: string
  /** Slugs of the towns and municipalities the person is linked to, for the unit filter */
  municipalitySlugs: string[]
}

export type PublicPersonRole = 'rodjen' | 'zivio' | 'djelovao' | 'umro' | 'pokopan'

export interface PublicPersonPlaceGroup {
  role: PublicPersonRole
  /** "Rođen/a", "Živio/la", ... */
  label: string
  places: Array<{ id: string, name: string, path: string }>
}

export interface PublicPerson extends PublicPersonListItem {
  /** Stable id for correction submissions (their `targetId`) */
  ref: string
  born: string | null
  died: string
  /** Free-text places outside the area, shown as plain text */
  bornPlace: string | null
  diedPlace: string | null
  bio: string | null
  openQuestions: string | null
  verification: AtlasItemStatus
  noindex: boolean
  /** Linked places grouped by role, in the fixed role order; roles without places are left out */
  placeGroups: PublicPersonPlaceGroup[]
  heritage: Array<{ id: string, name: string, path: string | null, relation: string, verification: AtlasItemStatus }>
  /** Stories, Customs and Folk texts the person wrote, or told through a named narrator who is this person */
  intangible: PublicIntangibleRef[]
  sources: PublicSource[]
  updatedAt: string
}

export interface PublicHeritageItem extends PublicHeritageListItem {
  /**
   * Stable id for correction submissions (their `targetId`): the old item id for imported items
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
  /** Photos in order; the first is the main one */
  images: PublicImage[]
  /** "Povezane osobe": live persons linked to this item */
  persons: PublicPersonRef[]
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
  /** Persons linked to the unit or to one of its settlements */
  persons: PublicPersonRef[]
  /** "Priče i običaji" tied to the unit or to one of its settlements */
  intangible: PublicIntangibleRef[]
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
  /** "Osobe iz ovog mjesta" */
  persons: PublicPersonRef[]
  /** "Priče i običaji" tied to this settlement */
  intangible: PublicIntangibleRef[]
}

export interface AtlasHeritageListResponse {
  items: PublicHeritageListItem[]
  /** Filter options: categories (with counts) and municipalities that have items in the full list */
  categories: Array<PublicCategoryRef & { count: number }>
  municipalities: Array<Pick<PublicMunicipalityRef, 'slug' | 'label'>>
  total: number
}

export interface AtlasPersonListResponse {
  persons: PublicPersonListItem[]
  /** Unit filter options: towns and municipalities that have at least one person */
  municipalities: Array<Pick<PublicMunicipalityRef, 'slug' | 'label'>>
  total: number
}

export interface AtlasPersonResponse {
  person: PublicPerson
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
    | { kind: 'person', person: PublicPersonListItem & { ref: string } }

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
