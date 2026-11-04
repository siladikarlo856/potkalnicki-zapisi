import type { DailyCategory } from '../dailyWord'

export type CardKind = 'word' | 'place' | 'item' | 'person'
/** 'word:<wordId>' | 'place:<settlementId>' | 'item:<heritageItemId>' | 'person:<personId>' */
export type CardKey = `${CardKind}:${string}`
export const CARD_KEY = /^(word|place|item|person):[A-Za-z0-9-]{1,64}$/

export type TopicId = string

interface CardBase { key: CardKey, id: string, topics: TopicId[] }

export interface PoolWord extends CardBase {
  kind: 'word'
  headword: string
  meaning: string
  meaningEn?: string
  partOfSpeech?: string
  category?: DailyCategory
  variants: string[]
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

export type PoolCard = PoolWord | PoolPlace | PoolItem | PoolPerson

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
