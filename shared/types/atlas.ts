import type { PzMunicipalityId } from '../data/pzMunicipalities'

export type AtlasItemStatus = 'unverified' | 'in_review' | 'verified' | 'needs_update'

export interface AtlasMunicipality {
  id: PzMunicipalityId
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
  municipalityId: PzMunicipalityId
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
  municipalityId: PzMunicipalityId
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
