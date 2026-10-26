/** A place at any level. Areas form a hierarchy (settlement -> municipality/town -> county -> country). */
export interface Area {
  id: string
  name: string
  kind: 'settlement' | 'municipality' | 'town' | 'county' | 'region' | 'country'
  /** Primary parent, used for breadcrumbs and for rolling usages up on a map. */
  parentId: string | null
  /** Extra containing areas, e.g. a dialect region that crosses administrative borders. */
  alsoIn?: string[]
  centroid?: { lat: number, lng: number } | null
  boundaryRef?: string
  externalIds?: Record<string, string>
}

/** `placeholder` is sample data; `community` is approved community content; `verified` is editor-confirmed. */
export type ContentStatus = 'placeholder' | 'community' | 'verified'

/** "This form is used in this area": the row a usage map is drawn from. */
export interface AreaUsage {
  /** Finest known level, ideally a settlement. */
  areaId: string
  confidence: 'reported' | 'confirmed'
  sourceId?: string
  note?: string
}

/** One spelling or pronunciation of a word. */
export interface Variant {
  id: string
  form: string
  pronunciation?: string
  audio?: string
  usages: AreaUsage[]
  status: ContentStatus
}

export interface Example {
  text: string
  translation?: string
  areaId?: string
}

export interface SourceRef {
  id: string
  kind: 'contribution' | 'interview' | 'publication' | 'editor'
  credit?: string
}

/** One dictionary entry: a single meaning shared by all of its regional spellings. */
export interface WordEntry {
  id: string
  /** Display form only; it is also the first variant, so no village is privileged. */
  headword: string
  meaning: { hr: string, en?: string }
  partOfSpeech?: string
  examples?: Example[]
  /** Includes the headword's own spelling as the first item. */
  variants: Variant[]
  tags?: string[]
  status: ContentStatus
  sources: SourceRef[]
}
