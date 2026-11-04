import type { DailyCategory } from '../dailyWord'
import type { CardKey, CardPool, PoolPlace, PoolWord } from '../learn/types'
import { WORD_CATEGORY_TOPICS } from '../learn/topics'
import type { Rng } from './rng'
import { mulberry32, shuffled } from './rng'

export type GroupingMode = 'words' | 'places'

export interface GroupingTile {
  id: string
  cardKey: CardKey
  label: string
  groupId: string
}

export interface GroupingGroup {
  id: string
  label: string
  colorIndex: 0 | 1 | 2 | 3
  tileIds: readonly string[]
}

export interface GroupingPuzzle {
  mode: GroupingMode
  seed: number
  tiles: GroupingTile[]
  groups: GroupingGroup[]
}

export const GROUP_EMOJI = ['🟩', '🟦', '🟨', '🟪'] as const

const CATEGORY_LABEL = new Map<DailyCategory, string>(
  WORD_CATEGORY_TOPICS.map(row => [row.category, row.label])
)

export function hashDaySeed(day: string): number {
  let hash = 0
  for (let i = 0; i < day.length; i++) {
    hash = (Math.imul(31, hash) + day.charCodeAt(i)) >>> 0
  }
  return hash || 1
}

function wordGroups(pool: CardPool): { id: string, label: string, words: PoolWord[] }[] {
  const byCategory = new Map<DailyCategory, PoolWord[]>()
  for (const card of pool.cards) {
    if (card.kind !== 'word' || card.status !== 'verified' || !card.category) continue
    const list = byCategory.get(card.category) ?? []
    list.push(card)
    byCategory.set(card.category, list)
  }
  return [...byCategory.entries()]
    .filter(([, words]) => words.length >= 4)
    .map(([category, words]) => ({
      id: `cat:${category}`,
      label: CATEGORY_LABEL.get(category) ?? category,
      words
    }))
}

function placeGroups(pool: CardPool): { id: string, label: string, places: PoolPlace[] }[] {
  const byUnit = new Map<string, PoolPlace[]>()
  for (const card of pool.cards) {
    if (card.kind !== 'place') continue
    const list = byUnit.get(card.municipalityId) ?? []
    list.push(card)
    byUnit.set(card.municipalityId, list)
  }
  return [...byUnit.entries()]
    .filter(([, places]) => places.length >= 4)
    .map(([municipalityId, places]) => {
      const municipality = pool.municipalities.find(m => m.id === municipalityId)
      return {
        id: `unit:${municipalityId}`,
        label: municipality?.label ?? municipality?.name ?? municipalityId,
        places
      }
    })
}

function pickFour<T>(items: readonly T[], rng: Rng): T[] {
  return shuffled(items, rng).slice(0, 4)
}

export function groupingModeAvailable(pool: CardPool, mode: GroupingMode): boolean {
  return mode === 'words' ? wordGroups(pool).length >= 4 : placeGroups(pool).length >= 4
}

export function groupingAvailable(pool: CardPool): boolean {
  return groupingModeAvailable(pool, 'words') || groupingModeAvailable(pool, 'places')
}

export function pickGroupingMode(pool: CardPool, rng: Rng): GroupingMode | null {
  const wordsOk = groupingModeAvailable(pool, 'words')
  const placesOk = groupingModeAvailable(pool, 'places')
  if (wordsOk && placesOk) return rng() < 0.5 ? 'words' : 'places'
  if (wordsOk) return 'words'
  if (placesOk) return 'places'
  return null
}

export function buildGroupingPuzzle(pool: CardPool, mode: GroupingMode, seed: number): GroupingPuzzle | null {
  const rng = mulberry32(seed)
  const groups: GroupingGroup[] = []
  const tiles: GroupingTile[] = []

  if (mode === 'words') {
    const sourceGroups = wordGroups(pool)
    if (sourceGroups.length < 4) return null
    const chosen = pickFour(sourceGroups, rng)
    chosen.forEach((group, index) => {
      const colorIndex = index as 0 | 1 | 2 | 3
      const members = pickFour(group.words, rng)
      const tileIds: string[] = []
      members.forEach((member, memberIndex) => {
        const tileId = `${group.id}:${memberIndex}:${member.id}`
        tileIds.push(tileId)
        tiles.push({
          id: tileId,
          cardKey: member.key,
          label: member.headword,
          groupId: group.id
        })
      })
      groups.push({ id: group.id, label: group.label, colorIndex, tileIds })
    })
  } else {
    const sourceGroups = placeGroups(pool)
    if (sourceGroups.length < 4) return null
    const chosen = pickFour(sourceGroups, rng)
    chosen.forEach((group, index) => {
      const colorIndex = index as 0 | 1 | 2 | 3
      const members = pickFour(group.places, rng)
      const tileIds: string[] = []
      members.forEach((member, memberIndex) => {
        const tileId = `${group.id}:${memberIndex}:${member.id}`
        tileIds.push(tileId)
        tiles.push({
          id: tileId,
          cardKey: member.key,
          label: member.name,
          groupId: group.id
        })
      })
      groups.push({ id: group.id, label: group.label, colorIndex, tileIds })
    })
  }

  return {
    mode,
    seed,
    tiles: shuffled(tiles, rng),
    groups
  }
}

export function tileById(puzzle: GroupingPuzzle, tileId: string): GroupingTile | undefined {
  return puzzle.tiles.find(tile => tile.id === tileId)
}

export function groupForTile(puzzle: GroupingPuzzle, tileId: string): GroupingGroup | undefined {
  const tile = tileById(puzzle, tileId)
  if (!tile) return undefined
  return puzzle.groups.find(group => group.id === tile.groupId)
}

export type GroupingGuessResult = 'incomplete' | 'correct' | 'wrong' | 'one-away'

/** True when exactly three of four selected tiles share one group (Connections "one away"). */
export function isOneAway(puzzle: GroupingPuzzle, selectedIds: readonly string[]): boolean {
  if (selectedIds.length !== 4) return false
  const counts = new Map<string, number>()
  for (const id of selectedIds) {
    const tile = tileById(puzzle, id)
    if (!tile) return false
    counts.set(tile.groupId, (counts.get(tile.groupId) ?? 0) + 1)
  }
  return [...counts.values()].some(count => count === 3)
}

export function evaluateGroupingGuess(puzzle: GroupingPuzzle, selectedIds: readonly string[]): GroupingGuessResult {
  if (selectedIds.length !== 4) return 'incomplete'
  const groups = selectedIds.map(id => tileById(puzzle, id)?.groupId)
  if (groups.some(g => !g)) return 'wrong'
  const unique = new Set(groups)
  if (unique.size === 1) {
    const groupId = groups[0]!
    const group = puzzle.groups.find(g => g.id === groupId)
    if (!group) return 'wrong'
    const selected = new Set(selectedIds)
    const matchesGroup = group.tileIds.every(id => selected.has(id)) && selectedIds.every(id => group.tileIds.includes(id))
    return matchesGroup ? 'correct' : 'wrong'
  }
  if (isOneAway(puzzle, selectedIds)) return 'one-away'
  return 'wrong'
}

/** Share grid: one emoji per tile in display order, coloured by solved group. */
export function groupingShareEmoji(puzzle: GroupingPuzzle): string {
  const emojiByGroup = new Map(puzzle.groups.map(g => [g.id, GROUP_EMOJI[g.colorIndex]]))
  const rows: string[] = []
  for (let row = 0; row < 4; row++) {
    let line = ''
    for (let col = 0; col < 4; col++) {
      const tile = puzzle.tiles[row * 4 + col]
      line += tile ? (emojiByGroup.get(tile.groupId) ?? '⬜') : '⬜'
    }
    rows.push(line)
  }
  return rows.join('\n')
}

export function dailyGroupingSeed(day: string, mode: GroupingMode): number {
  return (hashDaySeed(day) ^ (mode === 'words' ? 0x9e3779b9 : 0x6a09e667)) >>> 0
}
