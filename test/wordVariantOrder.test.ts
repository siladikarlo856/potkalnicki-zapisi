import { describe, expect, it } from 'vitest'
import { orderVariantsForPlace } from '../shared/utils/wordVariantOrder'

const variants = [
  { id: 'base', form: 'škrlec', usages: [{ areaId: 'other' }] },
  { id: 'match-b', form: 'škrleč', usages: [{ areaId: 'fodrovec' }] },
  { id: 'match-a', form: 'škrlecak', usages: [{ areaId: 'fodrovec' }] }
]

describe('orderVariantsForPlace', () => {
  it('keeps editor order without a chosen place', () => {
    expect(orderVariantsForPlace(variants)).toEqual({
      ordered: variants,
      state: 'no-preference'
    })
  })

  it('puts the first matching usage first and marks the match', () => {
    const result = orderVariantsForPlace(variants, 'fodrovec')
    expect(result.state).toBe('matched')
    expect(result.preferredId).toBe('match-b')
    expect(result.ordered.map(v => v.id)).toEqual(['match-b', 'base', 'match-a'])
  })

  it('picks the earliest match when several variants share the place', () => {
    const many = [
      { id: 'base', form: 'a', usages: [{ areaId: 'elsewhere' }] },
      { id: 'match-b', form: 'b', usages: [{ areaId: 'place' }] },
      { id: 'match-c', form: 'c', usages: [{ areaId: 'place' }] }
    ]
    const result = orderVariantsForPlace(many, 'place')
    expect(result.preferredId).toBe('match-b')
    expect(result.ordered.map(v => v.id)).toEqual(['match-b', 'base', 'match-c'])
  })

  it('keeps the base form first when nothing matches', () => {
    const result = orderVariantsForPlace(variants, 'apatovec')
    expect(result).toEqual({ ordered: variants, state: 'no-match' })
  })

  it('still lists every variant after reordering', () => {
    const result = orderVariantsForPlace(variants, 'fodrovec')
    expect(result.ordered).toHaveLength(variants.length)
    expect(new Set(result.ordered.map(v => v.id))).toEqual(new Set(variants.map(v => v.id)))
  })
})
