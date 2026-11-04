import type { CardKey, CardPool, PoolCard, TopicId } from './types'
import type { CardProgress } from './leitner'
import { isDue } from './leitner'
import { cardMatchesTopicSelection, municipalitySlugMap } from './topics'

export interface SessionOptions {
  n: number
  topics: TopicId[]
  place?: string
  today: string
  mode?: 'new' | 'review'
}

function cardKind(key: CardKey, byKey: Map<CardKey, PoolCard>): PoolCard['kind'] | undefined {
  return byKey.get(key)?.kind
}

function matchesPlaceFilter(card: PoolCard, pool: CardPool, placeSlug: string | undefined): boolean {
  if (!placeSlug) return true
  const settlement = pool.settlements.find(s => s.slug === placeSlug)
  if (!settlement) return false
  switch (card.kind) {
    case 'word':
      return false
    case 'place':
      return card.municipalityId === settlement.municipalityId
    case 'item':
      return card.settlementId === settlement.id || card.municipalityId === settlement.municipalityId
    case 'person':
      return card.areaIds.includes(settlement.id) || card.areaIds.includes(settlement.municipalityId)
  }
}

function firstMatchingTopic(
  selected: TopicId[],
  card: PoolCard,
  municipalitySlugById: Map<string, string>
): TopicId | undefined {
  for (const topicId of selected) {
    if (cardMatchesTopicSelection(card, [topicId], municipalitySlugById)) return topicId
  }
  return undefined
}

function progressFor(key: CardKey, progress: Record<string, CardProgress>): CardProgress | undefined {
  return Object.hasOwn(progress, key) ? progress[key] : undefined
}

function compareDue(a: CardKey, b: CardKey, progress: Record<string, CardProgress>): number {
  const pa = progressFor(a, progress)!
  const pb = progressFor(b, progress)!
  if (pa.due !== pb.due) return pa.due < pb.due ? -1 : 1
  if (pa.box !== pb.box) return pa.box - pb.box
  return a < b ? -1 : a > b ? 1 : 0
}

function sortNewCards(cards: PoolCard[]): PoolCard[] {
  return [...cards].sort((a, b) => {
    if (a.kind === 'word' && b.kind === 'word') {
      if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty
      if (a.transparency !== b.transparency) return b.transparency - a.transparency
      return a.headword.localeCompare(b.headword, 'hr')
    }
    if (a.kind === 'place' && b.kind === 'place') {
      if (a.seat !== b.seat) return a.seat ? -1 : 1
      if (a.itemCount !== b.itemCount) return b.itemCount - a.itemCount
      return a.name.localeCompare(b.name, 'hr')
    }
    if (a.kind === 'item' && b.kind === 'item') {
      if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty
      return a.name.localeCompare(b.name, 'hr')
    }
    if (a.kind === 'person' && b.kind === 'person') {
      return a.name.localeCompare(b.name, 'hr')
    }
    return a.key < b.key ? -1 : 1
  })
}

function sortKnown(keys: CardKey[], progress: Record<string, CardProgress>): CardKey[] {
  return [...keys].sort((a, b) => {
    const pa = progressFor(a, progress)!
    const pb = progressFor(b, progress)!
    if (pa.lastPlayed !== pb.lastPlayed) return pa.lastPlayed < pb.lastPlayed ? -1 : 1
    return a < b ? -1 : a > b ? 1 : 0
  })
}

function pickRoundRobin(lists: Map<TopicId, CardKey[]>, limit: number): CardKey[] {
  const order = [...lists.keys()]
  const out: CardKey[] = []
  while (out.length < limit) {
    let moved = false
    for (const id of order) {
      const list = lists.get(id)!
      if (list.length) {
        out.push(list.shift()!)
        moved = true
        if (out.length >= limit) break
      }
    }
    if (!moved) break
  }
  return out
}

function interleaveByGroup(selected: Map<TopicId, CardKey[]>, topicOrder: TopicId[]): CardKey[] {
  const lists = new Map(topicOrder.map(id => [id, [...(selected.get(id) ?? [])]]))
  return pickRoundRobin(lists, Number.MAX_SAFE_INTEGER)
}

function breakAdjacentKinds(keys: CardKey[], byKey: Map<CardKey, PoolCard>): CardKey[] {
  const queue = [...keys]
  for (let i = 1; i < queue.length; i++) {
    const prevKind = cardKind(queue[i - 1]!, byKey)
    const curKind = cardKind(queue[i]!, byKey)
    if (!prevKind || prevKind === curKind) {
      let swap = -1
      for (let j = i + 1; j < queue.length; j++) {
        const kind = cardKind(queue[j]!, byKey)
        if (kind && kind !== prevKind) {
          swap = j
          break
        }
      }
      if (swap === -1) continue
      const [picked] = queue.splice(swap, 1)
      queue.splice(i, 0, picked!)
    }
  }
  return queue
}

export function buildSession(
  pool: CardPool,
  progress: Record<string, CardProgress>,
  o: SessionOptions
): CardKey[] {
  const municipalitySlugById = municipalitySlugMap(pool.municipalities)
  const byKey = new Map(pool.cards.map(c => [c.key, c]))
  const topicOrder = [...o.topics]

  const grouped = new Map<TopicId, { due: CardKey[], neu: CardKey[], known: CardKey[] }>()
  for (const id of topicOrder) {
    grouped.set(id, { due: [], neu: [], known: [] })
  }

  for (const card of pool.cards) {
    if (!matchesPlaceFilter(card, pool, o.place)) continue
    if (!cardMatchesTopicSelection(card, o.topics, municipalitySlugById)) continue
    const group = firstMatchingTopic(o.topics, card, municipalitySlugById)
    if (!group) continue
    const p = progressFor(card.key, progress)
    const buckets = grouped.get(group)!
    if (p && isDue(p, o.today)) buckets.due.push(card.key)
    else if (!p || p.box === 0) buckets.neu.push(card.key)
    else buckets.known.push(card.key)
  }

  for (const [, buckets] of grouped) {
    buckets.due.sort((a, b) => compareDue(a, b, progress))
    const neuCards = sortNewCards(buckets.neu.map(k => byKey.get(k)!).filter(Boolean))
    buckets.neu = neuCards.map(c => c.key)
    buckets.known = sortKnown(buckets.known, progress)
  }

  if (o.mode === 'review') {
    const dueAll = topicOrder.flatMap(id => grouped.get(id)!.due).sort((a, b) => compareDue(a, b, progress))
    return dueAll.slice(0, o.n)
  }

  const dueLists = new Map(topicOrder.map(id => [id, [...grouped.get(id)!.due]]))
  const neuLists = new Map(topicOrder.map(id => [id, [...grouped.get(id)!.neu]]))
  const knownLists = new Map(topicOrder.map(id => [id, [...grouped.get(id)!.known]]))

  const picked = new Map<TopicId, CardKey[]>(topicOrder.map(id => [id, []]))
  const appendPicks = (keys: CardKey[]) => {
    for (const key of keys) {
      const group = firstMatchingTopic(o.topics, byKey.get(key)!, municipalitySlugById)!
      picked.get(group)!.push(key)
    }
  }

  const dueCap = Math.floor(0.6 * o.n)
  appendPicks(pickRoundRobin(dueLists, dueCap))
  let total = [...picked.values()].reduce((n, list) => n + list.length, 0)
  appendPicks(pickRoundRobin(neuLists, Math.max(0, o.n - total)))
  total = [...picked.values()].reduce((n, list) => n + list.length, 0)
  if (total < o.n) {
    appendPicks(pickRoundRobin(dueLists, o.n - total))
    total = [...picked.values()].reduce((n, list) => n + list.length, 0)
  }
  if (total < o.n) appendPicks(pickRoundRobin(knownLists, o.n - total))

  const ordered = interleaveByGroup(picked, topicOrder)
  return breakAdjacentKinds(ordered.slice(0, o.n), byKey)
}
