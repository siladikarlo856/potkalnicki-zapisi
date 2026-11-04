import type { CardPool, PoolCard, PoolItem, PoolPerson, PoolPlace, PoolWord } from '~~/shared/utils/learn/types'
import { pzRoutes } from '~~/shared/utils/appRoutes'

export function formatLearnStartedAt(iso: string, now = new Date()): string {
  const started = new Date(iso)
  const time = new Intl.DateTimeFormat('hr-HR', { hour: '2-digit', minute: '2-digit' }).format(started)
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const today = dayKey(now)
  const startDay = dayKey(started)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (startDay === today) return `danas u ${time}`
  if (startDay === dayKey(yesterday)) return `jučer u ${time}`
  const date = new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'numeric' }).format(started)
  return `${date} u ${time}`
}

export function municipalityLabel(pool: CardPool, municipalityId: string): string {
  return pool.municipalities.find(m => m.id === municipalityId)?.label ?? municipalityId
}

export function settlementName(pool: CardPool, settlementId: string): string {
  return pool.settlements.find(s => s.id === settlementId)?.name ?? settlementId
}

export function cardByKey(pool: CardPool, key: string): PoolCard | undefined {
  return pool.cards.find(c => c.key === key)
}

export function topicLabels(pool: CardPool, topicIds: string[]): string {
  const labels = topicIds.map(id => pool.topics.find(t => t.id === id)?.label ?? id)
  return labels.join(' + ')
}

export function gamesHrefWithTopic(topics: string[]): string {
  const top = topics.find(id => !id.includes('-')) ?? topics[0] ?? 'rijeci'
  return `${pzRoutes.games}?tema=${encodeURIComponent(top)}`
}

export function missedKeys(results: Record<string, 'known' | 'missed'>): string[] {
  return Object.entries(results).filter(([, v]) => v === 'missed').map(([k]) => k)
}

export function knownCount(results: Record<string, 'known' | 'missed'>): number {
  return Object.values(results).filter(v => v === 'known').length
}

export function topicStats(
  pool: CardPool,
  topics: string[],
  results: Record<string, 'known' | 'missed'>,
  byKey: Map<string, PoolCard>
) {
  return topics.map((topicId) => {
    const label = pool.topics.find(t => t.id === topicId)?.label ?? topicId
    const keys = Object.keys(results).filter((key) => {
      const card = byKey.get(key)
      return card?.topics.includes(topicId)
    })
    const total = keys.length
    const learned = keys.filter(k => results[k as keyof typeof results] === 'known').length
    return { topicId, label, learned, total }
  }).filter(row => row.total > 0)
}

export function personPlaceLabel(pool: CardPool, person: PoolPerson): string {
  const areaId = person.areaIds[0]
  if (!areaId) return ''
  const settlement = pool.settlements.find(s => s.id === areaId)
  if (settlement) return settlement.name
  return municipalityLabel(pool, areaId)
}

export type DisplayCard = PoolWord | PoolPlace | PoolItem | PoolPerson

export function isDisplayCard(card: PoolCard | undefined): card is DisplayCard {
  return card?.kind === 'word' || card?.kind === 'place' || card?.kind === 'item' || card?.kind === 'person'
}
