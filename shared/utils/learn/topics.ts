import type { DailyCategory } from '../dailyWord'
import { pzRoutes } from '../appRoutes'
import type { CardKind, PoolCard, PoolItem, PoolPlace, PoolWord, TopicCount, TopicId } from './types'

export interface TopicDef {
  id: TopicId
  label: string
  parent?: TopicId
  kind?: CardKind
  status: 'live' | 'soon'
  soonHref?: string
}

export const WORD_CATEGORY_TOPICS: { id: TopicId, label: string, category: DailyCategory }[] = [
  { id: 'rijeci-ljudi', label: 'Ljudi', category: 'people' },
  { id: 'rijeci-hrana', label: 'Hrana', category: 'food' },
  { id: 'rijeci-dvoriste', label: 'Dvorište', category: 'yard' },
  { id: 'rijeci-kuca', label: 'Kuća', category: 'house' },
  { id: 'rijeci-odjeca', label: 'Odjeća', category: 'clothing' },
  { id: 'rijeci-vrijeme', label: 'Vrijeme', category: 'time' },
  { id: 'rijeci-tijelo', label: 'Tijelo', category: 'body' },
  { id: 'rijeci-posao', label: 'Posao', category: 'work' },
  { id: 'rijeci-obicaji', label: 'Običaji', category: 'customs' },
  { id: 'rijeci-funkcijske', label: 'Male riječi', category: 'function' },
  { id: 'rijeci-zivotinje', label: 'Životinje', category: 'animals' },
  { id: 'rijeci-osjecaji', label: 'Osjećaji', category: 'feelings' },
  { id: 'rijeci-priroda', label: 'Priroda', category: 'weather' }
]

const BASTINA_CRKVE = new Set(['church', 'cathedral', 'chapel', 'chapel-shrine', 'monastery'])
const BASTINA_LOKALITETI = new Set(['archaeological-site', 'historical-site'])
const BASTINA_POKLONCI = new Set(['wayside-shrine', 'cross', 'statue'])

const MEMORY_HREF = `${pzRoutes.contribute}?vrsta=sjecanje`

/** Dative forms for challenge explanations (H4.7). */
export const UNIT_DATIVE_BY_SLUG: Record<string, string> = {
  'grad-krizevci': 'Gradu Križevcima',
  'opcina-kalnik': 'Općini Kalnik',
  'opcina-gornja-rijeka': 'Općini Gornja Rijeka',
  'opcina-sveti-petar-orehovec': 'Općini Sveti Petar Orehovec',
  'opcina-sveti-ivan-zabno': 'Općini Sveti Ivan Žabno'
}

export function unitDative(slug: string, label: string): string {
  return UNIT_DATIVE_BY_SLUG[slug] ?? `jedinici „${label}”`
}

export function wordSubtopicForCategory(category: DailyCategory): { id: TopicId, label: string } | undefined {
  const row = WORD_CATEGORY_TOPICS.find(t => t.category === category)
  return row ? { id: row.id, label: row.label } : undefined
}

export function municipalityTopicId(municipalitySlug: string): TopicId {
  const base = municipalitySlug.replace(/^grad-/, '').replace(/^opcina-/, '')
  return `mjesta-${base}`
}

function baseTopics(municipalityTopics: TopicDef[]): TopicDef[] {
  return [
    { id: 'rijeci', label: 'Riječi', status: 'live' },
    ...WORD_CATEGORY_TOPICS.map(t => ({ id: t.id, label: t.label, parent: 'rijeci' as TopicId, kind: 'word' as CardKind, status: 'live' as const })),
    { id: 'mjesta', label: 'Mjesta', status: 'live' },
    ...municipalityTopics,
    { id: 'bastina', label: 'Baština', status: 'live' },
    { id: 'bastina-crkve', label: 'Crkve i kapele', parent: 'bastina', kind: 'item', status: 'live' },
    { id: 'bastina-lokaliteti', label: 'Arheološka i povijesna mjesta', parent: 'bastina', kind: 'item', status: 'live' },
    { id: 'bastina-poklonci', label: 'Poklonci, križevi i kipovi', parent: 'bastina', kind: 'item', status: 'live' },
    { id: 'osobe', label: 'Osobe', status: 'soon', soonHref: MEMORY_HREF },
    { id: 'sport', label: 'Sport i klubovi', kind: 'club', status: 'soon' },
    { id: 'legende', label: 'Legende i priče', status: 'soon', soonHref: MEMORY_HREF }
  ]
}

export function buildTopicDefs(municipalityLabels: { slug: string, label: string }[]): TopicDef[] {
  const municipalityTopics = municipalityLabels.map(m => ({
    id: municipalityTopicId(m.slug),
    label: m.label,
    parent: 'mjesta' as TopicId,
    kind: 'place' as CardKind,
    status: 'live' as const
  }))
  return baseTopics(municipalityTopics)
}

export const TOPICS: TopicDef[] = buildTopicDefs([])

const topicById = new Map(TOPICS.map(t => [t.id, t]))

export function topicDef(id: TopicId): TopicDef | undefined {
  return topicById.get(id)
}

function wordCategoryTopics(word: PoolWord): TopicId[] {
  const topics: TopicId[] = ['rijeci']
  if (!word.category) return topics
  const sub = WORD_CATEGORY_TOPICS.find(t => t.category === word.category)
  if (sub) topics.push(sub.id)
  return topics
}

function placeTopics(place: PoolPlace, municipalitySlugById: Map<string, string>): TopicId[] {
  const topics: TopicId[] = ['mjesta']
  const slug = municipalitySlugById.get(place.municipalityId)
  if (slug) topics.push(municipalityTopicId(slug))
  return topics
}

function itemTopics(item: PoolItem): TopicId[] {
  const topics: TopicId[] = ['bastina']
  if (BASTINA_CRKVE.has(item.categoryKey)) topics.push('bastina-crkve')
  if (BASTINA_LOKALITETI.has(item.categoryKey)) topics.push('bastina-lokaliteti')
  if (BASTINA_POKLONCI.has(item.categoryKey)) topics.push('bastina-poklonci')
  return topics
}

export function cardTopics(
  card: PoolCard,
  municipalitySlugById: Map<string, string>
): TopicId[] {
  switch (card.kind) {
    case 'word':
      return wordCategoryTopics(card)
    case 'place':
      return placeTopics(card, municipalitySlugById)
    case 'item':
      return itemTopics(card)
    case 'person':
      return ['osobe']
    case 'club':
      return ['sport']
  }
}

function topicMatchesCard(topicId: TopicId, card: PoolCard, municipalitySlugById: Map<string, string>): boolean {
  const cardTopicSet = new Set(cardTopics(card, municipalitySlugById))
  if (cardTopicSet.has(topicId)) return true
  const def = topicById.get(topicId)
  if (!def?.parent) return false
  return topicMatchesCard(def.parent, card, municipalitySlugById)
}

/** A card matches when it matches any selected topic (parents imply children). */
export function cardMatchesTopicSelection(
  card: PoolCard,
  selected: TopicId[],
  municipalitySlugById: Map<string, string>
): boolean {
  if (!selected.length) return true
  return selected.some(topicId => topicMatchesCard(topicId, card, municipalitySlugById))
}

function countForTopic(topicId: TopicId, cards: PoolCard[]): number {
  return cards.filter(card => card.topics.includes(topicId)).length
}

function countForTopicTree(topicId: TopicId, cards: PoolCard[], municipalitySlugById: Map<string, string>): number {
  return cards.filter(card => topicMatchesCard(topicId, card, municipalitySlugById)).length
}

export function computeTopicCounts(
  cards: PoolCard[],
  municipalityLabels: { slug: string, label: string }[],
  municipalitySlugById: Map<string, string>
): TopicCount[] {
  const defs = buildTopicDefs(municipalityLabels)
  const clubCount = cards.filter(c => c.kind === 'club').length
  return defs.flatMap((def) => {
    if (def.id === 'sport') {
      const live = clubCount >= 8
      const count = live ? clubCount : 0
      return [{ ...def, status: live ? 'live' as const : 'soon' as const, count }]
    }
    if (def.id === 'osobe') {
      const personCount = cards.filter(c => c.kind === 'person').length
      const live = personCount >= 4
      return [{
        ...def,
        status: live ? 'live' as const : 'soon' as const,
        soonHref: live ? undefined : MEMORY_HREF,
        count: live ? personCount : 0
      }]
    }
    if (def.parent === 'rijeci' && def.id.startsWith('rijeci-')) {
      const count = countForTopic(def.id, cards)
      if (count < 2) return []
    }
    const count = def.status === 'soon'
      ? 0
      : (def.id === 'rijeci' || def.id === 'mjesta' || def.id === 'bastina' || def.parent === 'mjesta' || def.parent === 'bastina')
          ? countForTopicTree(def.id, cards, municipalitySlugById)
          : countForTopic(def.id, cards)
    return [{ ...def, count }]
  })
}

export function municipalitySlugMap(municipalities: { id: string, slug: string }[]): Map<string, string> {
  return new Map(municipalities.map(m => [m.id, m.slug]))
}
