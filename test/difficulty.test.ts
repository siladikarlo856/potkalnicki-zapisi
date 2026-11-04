import { describe, expect, it } from 'vitest'
import { transparency, wordDifficulty } from '../shared/utils/learn/difficulty'

describe('learn difficulty helpers', () => {
  it('folds Croatian accents for transparency', () => {
    expect(transparency('Čičak Đurđa', 'cicak  durda')).toBe(1)
  })

  it('scores familiar dialect words higher than opaque ones', () => {
    expect(transparency('krumper', 'krumpir')).toBeGreaterThanOrEqual(0.6)
    expect(transparency('afinger', 'vješalica')).toBeLessThan(0.3)
  })

  it('cuts meanings at comma, semicolon or parenthesis', () => {
    expect(transparency('test', 'prvo, drugo')).toBe(transparency('test', 'prvo'))
    expect(transparency('test', 'prvo; drugo')).toBe(transparency('test', 'prvo'))
    expect(transparency('test', 'prvo (napomena)')).toBe(transparency('test', 'prvo'))
  })

  it('maps transparency to word difficulty bands', () => {
    expect(wordDifficulty(0.6)).toBe(1)
    expect(wordDifficulty(0.45)).toBe(2)
    expect(wordDifficulty(0.1)).toBe(3)
  })
})
