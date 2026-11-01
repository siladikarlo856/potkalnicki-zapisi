import { describe, expect, it } from 'vitest'
import catalog from '../server/data/places/hr.json'
import { foldPlace, placeById, placeSnapshot, resolveActivePlace, resolveContributionPlace, searchContributionPlaces, searchPlaces, CONTRIBUTION_PLACE_COUNT } from '../server/utils/places'

describe('reviewed Croatian catalog', () => {
  it('supports Croatian diacritics, đ transliterations and aliases', () => {
    expect(foldPlace(' ČĆŠŽĐ ')).toBe('ccszd')
    for (const query of ['krizevci', 'KRIŽEVCI']) expect(searchPlaces(query)[0]?.name).toBe('Križevci')
    expect(searchPlaces('cakovec')[0]?.name).toBe('Čakovec')
    expect(searchPlaces('dakovo')[0]?.name).toBe('Đakovo')
    expect(searchPlaces('djakovo')[0]?.name).toBe('Đakovo')
    expect(searchPlaces('Cittanova').some(p => p.id === 'geonames:3194379')).toBe(true)
  })

  it('keeps the reviewed towns, villages, islands and borders', () => {
    for (const id of ['3197230', '3194024', '12509643', '3195183', '3203392', '3202888', '3194379', '3194381', '3187685', '3196754', '3199128', '3203478']) {
      expect(resolveActivePlace(`geonames:${id}`), id).toBeDefined()
    }
    expect(searchPlaces('novigrad').filter(p => p.name.startsWith('Novigrad')).map(p => p.county)).toEqual(expect.arrayContaining(['Istarska županija', 'Zadarska županija']))
  })

  it('excludes nonsettlements, foreign/unknown IDs and retired duplicate IDs', () => {
    for (const id of ['geonames:3188728', 'geonames:7732866', 'geonames:2988507', 'geonames:9999999999']) expect(resolveActivePlace(id)).toBeUndefined()
    const retired = catalog.places.find(p => !p.active)!
    expect(placeById(retired.id)).toBeDefined()
    expect(resolveActivePlace(retired.id)).toBeUndefined()
  })

  it('has one active source ID per official settlement, canonical parents, retained coordinates and bounded snapshots', () => {
    const active = catalog.places.filter(p => p.active)
    expect(new Set(active.map(p => p.officialCode)).size).toBe(active.length)
    expect(active.length).toBeGreaterThan(6500)
    for (const place of active) {
      expect(place.countryCode).toBe('HR')
      expect(place.municipality).not.toBe('')
      expect(place.county).not.toBe('')
      expect(Number.isFinite(place.latitude) && Number.isFinite(place.longitude)).toBe(true)
      expect(placeSnapshot(place)).toContain(place.id)
      expect(placeSnapshot(place).length).toBeLessThanOrEqual(120)
    }
  })

  it('ranks exact names before prefixes and substrings, with deterministic bounded results', () => {
    expect(searchPlaces('Vis')[0]?.name).toBe('Vis')
    expect(searchPlaces('a')).toEqual([])
    expect(searchPlaces('a'.repeat(81))).toEqual([])
    expect(searchPlaces('gr')).toHaveLength(8)
    expect(searchPlaces('gr')).toEqual(searchPlaces('gr'))
  })
})

describe('Potkalničko prigorje contribution places', () => {
  it('covers exactly 135 active settlements across the five municipalities', () => {
    expect(CONTRIBUTION_PLACE_COUNT).toBe(135)
    expect(searchContributionPlaces('krizevci')[0]?.name).toBe('Križevci')
    expect(searchContributionPlaces('cakovec')).toEqual([])
    expect(resolveContributionPlace('geonames:3197230')).toBeDefined()
    expect(resolveContributionPlace('geonames:3194379')).toBeUndefined()
    expect(resolveActivePlace('geonames:3194379')).toBeDefined()
  })
})
