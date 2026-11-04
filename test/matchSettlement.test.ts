import { describe, expect, it } from 'vitest'
import { matchSettlement, nabrojiTimerSeconds, settlementMatchKey } from '../shared/utils/games/matchSettlement'

describe('matchSettlement', () => {
  const kalnikSettlements = [
    'Borje',
    'Kalnik',
    'Kamešnica',
    'Obrež Kalnički',
    'Popovec Kalnički',
    'Potok Kalnički',
    'Šopron',
    'Vojnovec Kalnički'
  ]

  it('matches diacritic-free input', () => {
    expect(matchSettlement('sopron', kalnikSettlements)).toBe('Šopron')
    expect(matchSettlement('kamesnica', kalnikSettlements)).toBe('Kamešnica')
  })

  it('accepts Sv. abbreviation for sveti', () => {
    const names = ['Sv. Petar Orehovec', 'Miholec']
    expect(matchSettlement('sv petar orehovec', names)).toBe('Sv. Petar Orehovec')
    expect(matchSettlement('sv. petar orehovec', names)).toBe('Sv. Petar Orehovec')
  })

  it('accepts hyphen and space variants', () => {
    expect(matchSettlement('obrež kalnicki', kalnikSettlements)).toBe('Obrež Kalnički')
    expect(matchSettlement('obrežkalnicki', kalnikSettlements)).toBe('Obrež Kalnički')
    expect(matchSettlement('potok kalnicki', kalnikSettlements)).toBe('Potok Kalnički')
  })

  it('does not match similar but different names from the seed', () => {
    const names = ['Mokrice Miholečke', 'Miholec']
    expect(matchSettlement('miholec', names)).toBe('Miholec')
    expect(matchSettlement('mokrice miholecke', names)).toBe('Mokrice Miholečke')
    expect(matchSettlement('mokrice', names)).toBeNull()
  })

  it('folds keys consistently', () => {
    expect(settlementMatchKey('Šopron')).toBe(settlementMatchKey('sopron'))
  })
})

describe('nabrojiTimerSeconds', () => {
  it('clamps between 90 and 600 seconds', () => {
    expect(nabrojiTimerSeconds(1)).toBe(90)
    expect(nabrojiTimerSeconds(8)).toBe(160)
    expect(nabrojiTimerSeconds(40)).toBe(600)
  })
})
