import { cardMatchesTopicSelection } from '../learn/topics'
import type { CardKey, CardPool, PoolItem, TopicId } from '../learn/types'
import { slugMap } from './distractors'
import type { Rng } from './rng'
import { shuffled } from './rng'

export interface HeritageMatchPair {
  itemKey: CardKey
  itemName: string
  settlementName: string
  verification: PoolItem['verification']
}

export interface HeritageMatchTile {
  id: string
  label: string
  pairIndex: number
}

export interface HeritageMatchBoard {
  pairs: HeritageMatchPair[]
  left: HeritageMatchTile[]
  right: HeritageMatchTile[]
}

export const HERITAGE_MATCH_BOARDS = 3
export const HERITAGE_MATCH_PAIRS = 4

function heritageItems(pool: CardPool, topics: TopicId[]): PoolItem[] {
  const slugs = slugMap(pool)
  return pool.cards.filter((c): c is PoolItem =>
    c.kind === 'item' && Boolean(c.settlementId) && cardMatchesTopicSelection(c, topics, slugs))
}

function settlementName(pool: CardPool, settlementId: string): string {
  return pool.settlements.find(s => s.id === settlementId)?.name ?? settlementId
}

/** Three boards of four church–settlement pairs; items must have a settlement. */
export function generateHeritageMatchBoards(
  pool: CardPool,
  topics: TopicId[],
  rng: Rng,
  boardCount = HERITAGE_MATCH_BOARDS
): HeritageMatchBoard[] {
  const items = shuffled(heritageItems(pool, topics), rng)
  const perBoard = HERITAGE_MATCH_PAIRS
  const maxBoards = Math.min(boardCount, Math.floor(items.length / perBoard))
  if (maxBoards < 1) return []

  const boards: HeritageMatchBoard[] = []
  for (let b = 0; b < maxBoards; b++) {
    const chunk = items.slice(b * perBoard, (b + 1) * perBoard)
    if (chunk.length < perBoard) break
    const pairs: HeritageMatchPair[] = chunk.map(item => ({
      itemKey: item.key,
      itemName: item.name,
      settlementName: settlementName(pool, item.settlementId),
      verification: item.verification
    }))
    boards.push({
      pairs,
      left: shuffled(pairs.map((p, i) => ({ id: `l-${b}-${i}`, label: p.itemName, pairIndex: i })), rng),
      right: shuffled(pairs.map((p, i) => ({ id: `r-${b}-${i}`, label: p.settlementName, pairIndex: i })), rng)
    })
  }
  return boards
}
