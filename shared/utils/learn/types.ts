import type { DailyCategory } from '../dailyWord'

export type CardKind = 'word' | 'place' | 'item' | 'person' | 'club'
/** 'word:<wordId>' | 'place:<settlementId>' | 'item:<heritageItemId>' | 'person:<personId>' | 'club:<clubId>' */
export type CardKey = `${CardKind}:${string}`
export const CARD_KEY = /^(word|place|item|person|club):[A-Za-z0-9-:]{1,80}$/

export type TopicId = string

interface CardBase { key: CardKey, id: string, topics: TopicId[] }

export interface PoolWordVariant {
  id: string
  form: string
  usages: { areaId: string }[]
}

export interface PoolWord extends CardBase {
  kind: 'word'
  headword: string
  meaning: string
  meaningEn?: string
  partOfSpeech?: string
  category?: DailyCategory
  variants: string[]
  /** Forms with settlement usages for preferred-variant ordering in learn. */
  variantDetails: PoolWordVariant[]
  status: 'community' | 'verified'
  transparency: number
  difficulty: 1 | 2 | 3
  slug?: string
}

export interface PoolPlace extends CardBase {
  kind: 'place'
  name: string
  slug: string
  municipalityId: string
  lat: number
  lng: number
  itemCount: number
  seat: boolean
  difficulty: 1 | 2 | 3
}

export interface PoolItem extends CardBase {
  kind: 'item'
  name: string
  path: string
  categoryKey: string
  categoryLabel: string
  settlementId: string
  municipalityId: string
  verification: 'unverified' | 'in_review' | 'verified' | 'needs_update'
  difficulty: 1 | 2 | 3
}

export interface PoolPerson extends CardBase {
  kind: 'person'
  name: string
  slug: string
  years: string
  clue: string
  role: string
  areaIds: string[]
  verification: PoolItem['verification']
}

export interface PoolClubSeason {
  season: string
  seasonLabel: string
  competition: string
  team: string
}

export interface PoolClub extends CardBase {
  kind: 'club'
  name: string
  slug: string
  sport: string
  settlementId: string
  settlementName: string
  settlementSlug: string
  municipalityId: string
  seniorSeason: PoolClubSeason | null
  verification: PoolItem['verification']
  difficulty: 1 | 2 | 3
}

export type PoolCard = PoolWord | PoolPlace | PoolItem | PoolPerson | PoolClub

export interface PoolMunicipality {
  id: string
  slug: string
  name: string
  label: string
  dative: string
  lat: number
  lng: number
}

export interface PoolSettlementRef { id: string, name: string, slug: string, municipalityId: string }

export interface TopicCount {
  id: TopicId
  label: string
  parent?: TopicId
  kind?: CardKind
  status: 'live' | 'soon'
  soonHref?: string
  count: number
}

export interface CardPool {
  version: 1
  generatedAt: string
  cards: PoolCard[]
  municipalities: PoolMunicipality[]
  settlements: PoolSettlementRef[]
  topics: TopicCount[]
}
