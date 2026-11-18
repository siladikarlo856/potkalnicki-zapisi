import type { AtlasItemStatus } from './atlas'
import type { PublicCredit, PublicPersonRef, PublicSource } from './publicAtlas'
import type { IntangibleKind } from '../utils/intangiblePublic'

// Response shapes of the public intangible heritage API (/api/atlas/intangible, /themes, /narrators). Paths are
// canonical, unlocalized site paths (pass them through localePath). Only published rows appear, and a narrator
// carries the name only when an editor recorded consent to publish it.

export interface PublicIntangibleRef {
  id: string
  kind: IntangibleKind
  /** "Priča", "Običaj", "Usmeni tekst" */
  kindLabel: string
  slug: string
  title: string
  /** "legenda/predaja", "pjesma", ... */
  typeLabel: string
  path: string
}

/** The public identity of a narrator or collector: the name with consent, otherwise the description. */
export interface PublicNarratorRef {
  id: string
  slug: string
  label: string
  /** The label is the real name (consent recorded); otherwise it is the anonymous description. */
  named: boolean
  path: string
}

export interface PublicPlaceRef {
  id: string
  name: string
  path: string
}

export interface PublicThemeRef {
  id: string
  slug: string
  label: string
  path: string
}

export interface PublicIntangibleListItem extends PublicIntangibleRef {
  /** The start of the text or description, for lists */
  excerpt: string | null
  occasion: string | null
  /** Where it was recorded */
  places: PublicPlaceRef[]
  themes: PublicThemeRef[]
  narrators: PublicNarratorRef[]
  verification: AtlasItemStatus
  /** A public record whose wording is held behind an explicit reader reveal. */
  sensitive?: boolean
}

export interface PublicIntangible extends PublicIntangibleListItem {
  textLocal: string | null
  textStandard: string | null
  description: string | null
  quotes: string[]
  /** Ordered actions for a multi-step Custom, such as a palm game. */
  steps: string[]
  /** Set in (stories) or Practised (customs), in the words people use or the approximate era */
  period: string | null
  /** "12. ožujka 1987.", only as precise as it is known */
  recordedOn: string | null
  recordedIn: PublicPlaceRef[]
  about: PublicPlaceRef[]
  collectors: PublicNarratorRef[]
  authors: PublicPersonRef[]
  heritage: Array<{ id: string, name: string, path: string | null }>
  words: Array<{ id: string, headword: string, path: string | null }>
  /** The Custom a Folk text belonged to ("said or sung when") */
  custom: PublicIntangibleRef | null
  /** The Folk texts of a Custom */
  folkTexts: PublicIntangibleRef[]
  sources: PublicSource[]
  credits: PublicCredit[]
  noindex: boolean
  updatedAt: string
}

export interface AtlasIntangibleResponse { record: PublicIntangible }

export interface AtlasIntangibleListResponse {
  records: PublicIntangibleListItem[]
  total: number
  /** The kind filter: plural labels ("Priče"), counted over what the other filters leave */
  kinds: Array<{ kind: IntangibleKind, slug: string, label: string, count: number }>
  /** The types of the selected kind with counts; empty until a kind is selected */
  types: Array<{ key: string, label: string, count: number }>
  themes: Array<{ slug: string, label: string, count: number }>
  /** Towns and municipalities with records (their settlements count), then the region when records name it */
  places: Array<{ slug: string, label: string, count: number }>
}

export interface PublicTheme extends PublicThemeRef {
  description: string | null
  updatedAt: string
}

export interface AtlasThemeResponse {
  theme: PublicTheme
  records: PublicIntangibleListItem[]
}

export interface PublicNarrator extends PublicNarratorRef {
  /** The anonymous description, also shown next to a name when there is one */
  description: string | null
  /** Details a named narrator allows; null for an unnamed one */
  living: boolean | null
  bornYear: number | null
  settlement: PublicPlaceRef | null
  /** The notable historical Person this narrator is, for a named narrator */
  person: PublicPersonRef | null
  noindex: boolean
  updatedAt: string
}

export interface AtlasNarratorResponse {
  narrator: PublicNarrator
  /** Stories, Customs and Folk texts they told */
  told: PublicIntangibleListItem[]
  /** Those they wrote down */
  collected: PublicIntangibleListItem[]
}
