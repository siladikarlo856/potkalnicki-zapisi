import { describe, expect, it } from 'vitest'
import type { CardPool, PoolCard, TopicId } from '../shared/utils/learn/types'
import type { CardProgress } from '../shared/utils/learn/leitner'
import { buildSession, reviewCardKeys } from '../shared/utils/learn/session'

const T = '2026-11-01T00:00:00.000Z'

function word(id: string, headword: string, topics: TopicId[], difficulty: 1 | 2 | 3 = 2, transparency = 0.5): PoolCard {
  return {
    kind: 'word',
    key: `word:${id}`,
    id,
    topics,
    headword,
    meaning: headword,
    variants: [],
    variantDetails: [],
    status: 'verified',
    transparency,
    difficulty
  }
}

function place(id: string, name: string, municipalityId: string, topic: TopicId): PoolCard {
  return {
    kind: 'place',
    key: `place:${id}`,
    id,
    topics: [topic],
    name,
    slug: name.toLowerCase(),
    municipalityId,
    lat: 46,
    lng: 16,
    itemCount: 1,
    seat: false,
    difficulty: 2
  }
}

function item(id: string, name: string, topic: TopicId): PoolCard {
  return {
    kind: 'item',
    key: `item:${id}`,
    id,
    topics: [topic],
    name,
    path: `/bastina/${id}`,
    categoryKey: 'church',
    categoryLabel: 'Crkva',
    settlementId: 'set-1',
    municipalityId: 'mun-1',
    verification: 'unverified',
    difficulty: 2
  }
}

function pool(cards: PoolCard[], topicIds: TopicId[]): CardPool {
  return {
    version: 1,
    generatedAt: T,
    cards,
    municipalities: [{ id: 'mun-1', slug: 'opcina-kalnik', name: 'Kalnik', label: 'Općina Kalnik', dative: 'Općini Kalnik', lat: 46, lng: 16 }],
    settlements: [{ id: 'set-1', name: 'Kalnik', slug: 'kalnik', municipalityId: 'mun-1' }],
    topics: topicIds.map(id => ({ id, label: id, status: 'live' as const, count: cards.length }))
  }
}

describe('buildSession', () => {
  const topics: TopicId[] = ['rijeci', 'mjesta', 'bastina']

  it('caps the first due pass at 60% before pulling new cards', () => {
    const cards = [
      ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((id, i) => word(id, `due-${id}`, ['rijeci'], (i % 3 + 1) as 1 | 2 | 3)),
      ...['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10'].map(id => word(id, `new-${id}`, ['rijeci'], 1, 0.9))
    ]
    const progress: Record<string, CardProgress> = {}
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']) {
      progress[`word:${id}`] = { box: 1, due: '2026-11-04', seen: 1, known: 0, missed: 1, lastPlayed: '2026-11-03' }
    }
    const session = buildSession(pool(cards, topics), progress, { n: 10, topics: ['rijeci'], today: '2026-11-04' })
    const dueKeys = session.filter(k => k.startsWith('word:') && progress[k]?.due === '2026-11-04')
    const newKeys = session.filter(k => k.startsWith('word:n'))
    expect(dueKeys.length).toBeLessThanOrEqual(6)
    expect(newKeys.length).toBeGreaterThanOrEqual(4)
    expect(session.length).toBe(10)
  })

  it('orders new words by difficulty then transparency', () => {
    const cards = [
      word('hard', 'hard', ['rijeci'], 3, 0.1),
      word('easy', 'easy', ['rijeci'], 1, 0.9),
      word('mid', 'mid', ['rijeci'], 2, 0.5)
    ]
    const session = buildSession(pool(cards, topics), {}, { n: 3, topics: ['rijeci'], today: '2026-11-04' })
    expect(session).toEqual(['word:easy', 'word:mid', 'word:hard'])
  })

  it('splits ten new cards across three topics 4/3/3', () => {
    const cards = [
      ...['w1', 'w2', 'w3', 'w4'].map(id => word(id, id, ['rijeci'])),
      ...['p1', 'p2', 'p3'].map(id => place(id, id, 'mun-1', 'mjesta-kalnik')),
      ...['i1', 'i2', 'i3'].map(id => item(id, id, 'bastina'))
    ]
    const session = buildSession(pool(cards, topics), {}, { n: 10, topics, today: '2026-11-04' })
    const counts = {
      rijeci: session.filter(k => k.startsWith('word:')).length,
      mjesta: session.filter(k => k.startsWith('place:')).length,
      bastina: session.filter(k => k.startsWith('item:')).length
    }
    expect(counts).toEqual({ rijeci: 4, mjesta: 3, bastina: 3 })
  })

  it('avoids adjacent cards of the same kind when possible', () => {
    const cards = [
      word('w1', 'w1', ['rijeci']),
      word('w2', 'w2', ['rijeci']),
      place('p1', 'p1', 'mun-1', 'mjesta-kalnik'),
      item('i1', 'i1', 'bastina')
    ]
    const session = buildSession(pool(cards, topics), {}, { n: 4, topics, today: '2026-11-04' })
    const kinds = session.map((key) => {
      if (key.startsWith('word:')) return 'word'
      if (key.startsWith('place:')) return 'place'
      return 'item'
    })
    for (let i = 1; i < kinds.length; i++) {
      if (kinds.slice(i).some(k => k !== kinds[i - 1])) expect(kinds[i]).not.toBe(kinds[i - 1])
    }
  })

  it('returns fewer than n when the pool is short', () => {
    const cards = [word('only', 'only', ['rijeci'])]
    const session = buildSession(pool(cards, topics), {}, { n: 10, topics: ['rijeci'], today: '2026-11-04' })
    expect(session).toEqual(['word:only'])
  })

  it('review mode returns only due cards', () => {
    const cards = [
      word('due', 'due', ['rijeci']),
      word('fresh', 'fresh', ['rijeci'])
    ]
    const progress: Record<string, CardProgress> = {
      'word:due': { box: 1, due: '2026-11-04', seen: 1, known: 0, missed: 1, lastPlayed: '2026-11-03' }
    }
    const session = buildSession(pool(cards, topics), progress, {
      n: 5,
      topics: ['rijeci'],
      today: '2026-11-04',
      mode: 'review'
    })
    expect(session).toEqual(['word:due'])
  })

  it('filters places by municipality when a settlement slug is chosen', () => {
    const cards = [
      place('p-kalnik', 'Kalnik', 'mun-1', 'mjesta-kalnik'),
      place('p-other', 'Apatovec', 'mun-2', 'mjesta-krizevci'),
      word('w1', 'riječ', ['rijeci'])
    ]
    const p = pool(cards, ['mjesta', 'rijeci'])
    p.municipalities.push({ id: 'mun-2', slug: 'grad-krizevci', name: 'Križevci', label: 'Grad Križevci', dative: 'Gradu Križevcima', lat: 46, lng: 16 })
    p.settlements.push({ id: 'set-2', name: 'Apatovec', slug: 'apatovec', municipalityId: 'mun-2' })
    const session = buildSession(p, {}, { n: 10, topics: ['mjesta'], place: 'kalnik', today: '2026-11-04' })
    expect(session).toEqual(['place:p-kalnik'])
    const mixed = buildSession(p, {}, { n: 10, topics: ['mjesta', 'rijeci'], place: 'kalnik', today: '2026-11-04' })
    expect(mixed.some(k => k.startsWith('word:'))).toBe(true)
    expect(mixed.filter(k => k.startsWith('place:')).every(k => k === 'place:p-kalnik')).toBe(true)
  })

  it('is deterministic for the same inputs', () => {
    const cards = [
      ...['w1', 'w2'].map(id => word(id, id, ['rijeci'])),
      place('p1', 'p1', 'mun-1', 'mjesta-kalnik'),
      item('i1', 'i1', 'bastina')
    ]
    const options = { n: 4, topics, today: '2026-11-04' } as const
    const a = buildSession(pool(cards, topics), {}, options)
    const b = buildSession(pool(cards, topics), {}, options)
    expect(a).toEqual(b)
  })

  it('uses the same review eligibility for all card kinds and place selections', () => {
    const cards: PoolCard[] = [
      word('w1', 'riječ', ['rijeci']),
      place('p1', 'Kalnik', 'mun-1', 'mjesta'),
      item('i1', 'Crkva', 'bastina'),
      { kind: 'person', key: 'person:p1', id: 'p1', topics: ['osobe'], name: 'Osoba', slug: 'osoba', years: '', clue: '', role: '', areaIds: ['mun-1'], verification: 'verified' },
      { kind: 'club', key: 'club:c1', id: 'c1', topics: ['sport'], name: 'Klub', slug: 'klub', sport: 'Nogomet', settlementId: 'set-1', settlementName: 'Kalnik', settlementSlug: 'kalnik', municipalityId: 'mun-1', seniorSeason: null, verification: 'verified', difficulty: 1 }
    ]
    const p = pool(cards, ['rijeci', 'mjesta', 'bastina', 'osobe', 'sport'])
    p.settlements.push({ id: 'set-2', name: 'Drugo', slug: 'drugo', municipalityId: 'mun-2' })
    const progress = Object.fromEntries([...cards.map(card => card.key), 'word:removed'].map(key => [key, {
      box: 1 as const, due: '2026-11-04', seen: 1, known: 0, missed: 1, lastPlayed: '2026-11-03'
    }]))
    for (const placeSlug of [undefined, 'kalnik', 'drugo', 'unknown']) {
      const keys = reviewCardKeys(p, placeSlug)
      const expected = placeSlug === 'unknown' ? [] : placeSlug === 'drugo' ? ['word:w1'] : cards.map(card => card.key)
      expect(keys).toEqual(expected)
      expect(buildSession(p, progress, {
        n: 20, topics: p.topics.map(topic => topic.id), today: '2026-11-04', mode: 'review', place: placeSlug
      }).sort()).toEqual([...expected].sort())
    }
    p.topics = p.topics.map(topic => topic.id === 'osobe' || topic.id === 'sport' ? { ...topic, status: 'soon' } : topic)
    expect(reviewCardKeys(p, 'kalnik')).toEqual(['word:w1', 'place:p1', 'item:i1'])
  })
})
