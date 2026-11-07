import type { CardKey, CardKind } from '../learn/types'

/**
 * A CardKey taken apart: the card's kind, the id of the entity behind it and, for a question that asks
 * something else about the same card (karta-tocke, the club games), the game's suffix.
 * `place:<uuid>` | `place:<uuid>:tocke` | `club:<uuid>:mjesto` | …
 */
export interface CardKeyParts {
  kind: CardKind
  id: string
  suffix?: string
}

const CARD_KEY_PARTS = /^(word|place|item|person|club):([^:\s]+)(?::([^:\s]+))?$/

export function encodeCardKey({ kind, id, suffix }: CardKeyParts): CardKey {
  return (suffix ? `${kind}:${id}:${suffix}` : `${kind}:${id}`) as CardKey
}

/** The parts of a card key, or null when the string is not one. */
export function decodeCardKey(key: string): CardKeyParts | null {
  const match = CARD_KEY_PARTS.exec(key)
  if (!match) return null
  const [, kind, id, suffix] = match
  return suffix ? { kind: kind as CardKind, id: id!, suffix } : { kind: kind as CardKind, id: id! }
}
