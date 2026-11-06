import { describe, expect, it } from 'vitest'
import { decodeCardKey, encodeCardKey } from '../shared/utils/games/cardKey'
import { questionCardKey } from '../shared/utils/games/definitions'

const UUID = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b'

describe('CardKey codec', () => {
  it.each([
    ['word', undefined, `word:${UUID}`],
    ['place', undefined, `place:${UUID}`],
    ['item', undefined, `item:${UUID}`],
    ['person', undefined, `person:${UUID}`],
    ['club', undefined, `club:${UUID}`],
    ['place', 'tocke', `place:${UUID}:tocke`],
    ['club', 'mjesto', `club:${UUID}:mjesto`],
    ['club', 'liga', `club:${UUID}:liga`],
    ['club', 'odakle', `club:${UUID}:odakle`]
  ] as const)('round-trips a %s card with suffix %s', (kind, suffix, key) => {
    expect(encodeCardKey({ kind, id: UUID, suffix })).toBe(key)
    expect(decodeCardKey(key)).toEqual(suffix ? { kind, id: UUID, suffix } : { kind, id: UUID })
  })

  it('reads a club card behind a question as the club with its plain id', () => {
    expect(decodeCardKey(`club:${UUID}:mjesto`)).toMatchObject({ kind: 'club', id: UUID })
  })

  it.each([
    ['znacenje', `word:${UUID}`],
    ['rijec', `word:${UUID}`],
    ['opcina', `place:${UUID}`],
    ['karta-koje', `place:${UUID}`],
    ['karta-tocke', `place:${UUID}:tocke`],
    ['crkva', `item:${UUID}`],
    ['osoba', `person:${UUID}`],
    ['klub-mjesto', `club:${UUID}:mjesto`],
    ['klub-liga', `club:${UUID}:liga`],
    ['klub-odakle', `club:${UUID}:odakle`]
  ] as const)('gives %s questions the card key %s', (game, key) => {
    expect(questionCardKey(game, UUID)).toBe(key)
  })

  it.each(['', 'word', 'word:', 'tree:abc', ':abc', 'club:abc:', 'club:abc:liga:extra', 'word:a b'])('rejects %j', (key) => {
    expect(decodeCardKey(key)).toBeNull()
  })
})
