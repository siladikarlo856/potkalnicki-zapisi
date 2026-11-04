import type { PublicWordEntry } from '../../shared/utils/word'
import { contentFold } from '../../shared/utils/content/common'
import { transparency, wordDifficulty } from '../../shared/utils/learn/difficulty'
import {
  cardTopics,
  computeTopicCounts,
  municipalitySlugMap,
  unitDative
} from '../../shared/utils/learn/topics'
import type {
  CardKey,
  CardPool,
  PoolCard,
  PoolClub,
  PoolItem,
  PoolMunicipality,
  PoolPerson,
  PoolPlace,
  PoolSettlementRef,
  PoolWord
} from '../../shared/utils/learn/types'
import { formatSeasonLabel } from '../../shared/utils/content/club'
import { heritageItemPath } from './publicAtlas'
import type { PublicContent, SnapshotClub, SnapshotItem, SnapshotPerson, SnapshotSettlement } from './publicContent'
import { getPublicContent } from './publicContent'
import { publicWords } from './words'

const KIND_ORDER: Record<PoolCard['kind'], number> = { word: 0, place: 1, item: 2, person: 3, club: 4 }

const CHURCH_DIFFICULTY_1 = new Set(['church', 'cathedral'])
const CHURCH_DIFFICULTY_2 = new Set(['chapel', 'chapel-shrine', 'monastery'])

function itemDifficulty(categoryKey: string): 1 | 2 | 3 {
  if (CHURCH_DIFFICULTY_1.has(categoryKey)) return 1
  if (CHURCH_DIFFICULTY_2.has(categoryKey)) return 2
  return 3
}

function placeDifficulty(seat: boolean, itemCount: number): 1 | 2 | 3 {
  if (seat) return 1
  if (itemCount >= 1) return 2
  return 3
}

function wordVariants(entry: PublicWordEntry): string[] {
  const forms = entry.variants.map(v => v.form).filter(Boolean)
  if (!forms.includes(entry.headword)) return [entry.headword, ...forms]
  return forms.length ? forms : [entry.headword]
}

function buildWordCard(entry: PublicWordEntry): PoolWord | null {
  if (entry.status === 'placeholder') return null
  const t = transparency(entry.headword, entry.meaning.hr)
  return {
    kind: 'word',
    key: `word:${entry.id}` as CardKey,
    id: entry.id,
    topics: [],
    headword: entry.headword,
    meaning: entry.meaning.hr.trim(),
    ...(entry.meaning.en ? { meaningEn: entry.meaning.en } : {}),
    ...(entry.partOfSpeech ? { partOfSpeech: entry.partOfSpeech } : {}),
    ...(entry.category ? { category: entry.category } : {}),
    variants: wordVariants(entry),
    status: entry.status === 'verified' ? 'verified' : 'community',
    transparency: t,
    difficulty: wordDifficulty(t),
    ...(entry.slug ? { slug: entry.slug } : {})
  }
}

function settlementItemCount(content: PublicContent, settlementId: string): number {
  return content.items.filter(item => item.settlementId === settlementId).length
}

function buildPlaceCard(content: PublicContent, settlement: SnapshotSettlement): PoolPlace | null {
  if (!settlement.centroid) return null
  const municipality = content.municipalityById.get(settlement.municipalityId)
  const seat = Boolean(municipality && municipality.name === settlement.name)
  const itemCount = settlementItemCount(content, settlement.id)
  return {
    kind: 'place',
    key: `place:${settlement.id}` as CardKey,
    id: settlement.id,
    topics: [],
    name: settlement.name,
    slug: settlement.slug,
    municipalityId: settlement.municipalityId,
    lat: settlement.centroid.lat,
    lng: settlement.centroid.lng,
    itemCount,
    seat,
    difficulty: placeDifficulty(seat, itemCount)
  }
}

function eligibleItems(content: PublicContent): SnapshotItem[] {
  const candidates = content.items.filter((item) => {
    if (item.noindex) return false
    if (!item.settlementId) return false
    return heritageItemPath(content, item) !== null
  })
  const nameCounts = new Map<string, number>()
  for (const item of candidates) {
    const folded = contentFold(item.name)
    nameCounts.set(folded, (nameCounts.get(folded) ?? 0) + 1)
  }
  return candidates.filter(item => nameCounts.get(contentFold(item.name)) === 1)
}

function buildItemCard(content: PublicContent, item: SnapshotItem): PoolItem | null {
  const path = heritageItemPath(content, item)
  if (!path || !item.settlementId) return null
  const category = content.categories.get(item.categoryId)
  const categoryKey = category?.key ?? 'unknown'
  return {
    kind: 'item',
    key: `item:${item.id}` as CardKey,
    id: item.id,
    topics: [],
    name: item.name,
    path,
    categoryKey,
    categoryLabel: category?.label ?? item.name,
    settlementId: item.settlementId,
    municipalityId: item.municipalityId,
    verification: item.verification,
    difficulty: itemDifficulty(categoryKey)
  }
}

function personYears(person: SnapshotPerson): string {
  return person.bornYear ? `${person.bornYear}–${person.diedYear}` : String(person.diedYear)
}

function buildPersonCard(content: PublicContent, person: SnapshotPerson): PoolPerson | null {
  const clue = content.personClueById.get(person.id)
  if (!clue) return null
  return {
    kind: 'person',
    key: `person:${person.id}` as CardKey,
    id: person.id,
    topics: [],
    name: person.name,
    slug: person.slug,
    years: personYears(person),
    clue,
    role: person.role,
    areaIds: person.areaLinks.map(link => link.areaId),
    verification: person.verification
  }
}

function buildClubCard(content: PublicContent, club: SnapshotClub): PoolClub | null {
  const settlement = content.settlementById.get(club.settlementId)
  if (!settlement) return null
  const senior = club.seasons
    .filter(s => s.team === 'seniori')
    .sort((a, b) => b.season.localeCompare(a.season))[0]
  const seniorSeason = senior
    ? { season: senior.season, seasonLabel: formatSeasonLabel(senior.season), competition: senior.competition, team: senior.team }
    : null
  const difficulty: 1 | 2 | 3 = seniorSeason ? (club.sport === 'nogomet' ? 2 : 3) : 3
  return {
    kind: 'club',
    key: `club:${club.id}` as CardKey,
    id: club.id,
    topics: [],
    name: club.name,
    slug: club.slug,
    sport: club.sport,
    settlementId: club.settlementId,
    settlementName: settlement.name,
    settlementSlug: settlement.slug,
    municipalityId: club.municipalityId,
    seniorSeason,
    verification: club.verification,
    difficulty
  }
}

function meanCentroid(settlements: SnapshotSettlement[]): { lat: number, lng: number } | null {
  const withCentroid = settlements.filter(s => s.centroid)
  if (!withCentroid.length) return null
  const lat = withCentroid.reduce((sum, s) => sum + s.centroid!.lat, 0) / withCentroid.length
  const lng = withCentroid.reduce((sum, s) => sum + s.centroid!.lng, 0) / withCentroid.length
  return { lat, lng }
}

function emptyPool(): CardPool {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    cards: [],
    municipalities: [],
    settlements: [],
    topics: computeTopicCounts([], [], new Map())
  }
}

export function buildCardPool(content: PublicContent, words: PublicWordEntry[]): CardPool {
  if (!content.region) return emptyPool()

  const slugByMunicipalityId = municipalitySlugMap(content.municipalities)
  const cards: PoolCard[] = []

  for (const entry of words) {
    const card = buildWordCard(entry)
    if (card) {
      card.topics = cardTopics(card, slugByMunicipalityId)
      cards.push(card)
    }
  }

  for (const settlement of content.settlements) {
    const card = buildPlaceCard(content, settlement)
    if (card) {
      card.topics = cardTopics(card, slugByMunicipalityId)
      cards.push(card)
    }
  }

  for (const item of eligibleItems(content)) {
    const card = buildItemCard(content, item)
    if (card) {
      card.topics = cardTopics(card, slugByMunicipalityId)
      cards.push(card)
    }
  }

  for (const person of content.persons) {
    const card = buildPersonCard(content, person)
    if (card) {
      card.topics = cardTopics(card, slugByMunicipalityId)
      cards.push(card)
    }
  }

  for (const club of content.clubs) {
    const card = buildClubCard(content, club)
    if (card) {
      card.topics = cardTopics(card, slugByMunicipalityId)
      cards.push(card)
    }
  }

  cards.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.key.localeCompare(b.key))

  const municipalities: PoolMunicipality[] = content.municipalities.flatMap((m) => {
    const unitSettlements = content.settlements.filter(s => s.municipalityId === m.id)
    const centroid = meanCentroid(unitSettlements)
    if (!centroid) return []
    return [{
      id: m.id,
      slug: m.slug,
      name: m.name,
      label: m.label,
      dative: unitDative(m.slug, m.label),
      lat: centroid.lat,
      lng: centroid.lng
    }]
  })

  const settlements: PoolSettlementRef[] = content.settlements.map(s => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    municipalityId: s.municipalityId
  }))

  const municipalityLabels = content.municipalities.map(m => ({ slug: m.slug, label: m.label }))
  const topics = computeTopicCounts(cards, municipalityLabels, slugByMunicipalityId)

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    cards,
    municipalities,
    settlements,
    topics
  }
}

type PoolCache = {
  at: number
  contentLoadedAt: number
  value: CardPool
  pending?: Promise<CardPool>
}

let cache: PoolCache | null = null

export function invalidateCardPool() {
  cache = null
}

async function loadPool(): Promise<CardPool> {
  const content = await getPublicContent()
  if (!content.region) return emptyPool()
  const { words } = await publicWords()
  return buildCardPool(content, words)
}

export async function getCardPool(): Promise<CardPool> {
  const content = await getPublicContent()
  const now = Date.now()
  if (cache && !cache.pending && now - cache.at < 60_000 && cache.contentLoadedAt === content.loadedAt) {
    return cache.value
  }
  if (cache?.pending) return cache.pending

  const previous = cache
  const pending = loadPool().then((value) => {
    cache = { at: Date.now(), contentLoadedAt: content.loadedAt, value }
    return value
  }, (error) => {
    if (cache?.pending === pending) cache = previous
    throw error
  })
  cache = { at: cache?.at ?? 0, contentLoadedAt: content.loadedAt, value: cache?.value ?? emptyPool(), pending }
  return pending
}
