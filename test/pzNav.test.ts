import { describe, expect, it } from 'vitest'
import { pzSectionForPath, pzTabForPath, pzTabs } from '../shared/utils/pzNav'

describe('pzNav tabs', () => {
  it('has the four tabs in order', () => {
    expect(pzTabs.map(tab => tab.label)).toEqual(['Početna', 'Igre', 'Istraži', 'Doprinesi'])
    expect(pzTabs.map(tab => tab.icon)).toEqual(['i-lucide-house', 'i-lucide-gamepad', 'i-lucide-compass', 'i-lucide-pen-line'])
  })

  it.each([
    ['', 'home'],
    ['/', 'home'],
    ['/igre/', 'games'],
    ['/igre/kviz/', 'games'],
    ['/uci/', 'games'],
    ['/mjesta/', 'explore'],
    ['/mjesta/opcina-kalnik/', 'explore'],
    ['/bastina/kalnik/crkva/', 'explore'],
    ['/govor/hiza/', 'explore'],
    ['/price-i-obicaji/', 'explore'],
    ['/price-i-obicaji/obicaji/martinje/', 'explore'],
    ['/price-i-obicaji/kazivaci/kazivacica-r-1938/', 'explore'],
    ['/mjesta/opcina-kalnik/kalnik/', 'explore'],
    ['/doprinesi/', 'contribute'],
    ['/doprinesi/?x=1#a', 'contribute'],
    ['/doprinesi', 'contribute']
  ])('marks %s as %s', (path, tab) => {
    expect(pzTabForPath(path)).toBe(tab)
  })

  it.each(['/o-projektu/', '/privatnost/', '/izazov/abc/'])('marks no tab on %s', (path) => {
    expect(pzTabForPath(path)).toBeNull()
  })

  it('maps pages to the seven header sections', () => {
    expect(pzSectionForPath('/igre/kviz/')).toBe('/igre/')
    expect(pzSectionForPath('/mjesta/opcina-kalnik/')).toBe('/mjesta/')
    expect(pzSectionForPath('/mjesta/opcina-kalnik/kalnik/')).toBe('/mjesta/')
    expect(pzSectionForPath('/bastina/kalnik/crkva/')).toBe('/bastina/')
    expect(pzSectionForPath('/govor/')).toBe('/govor/')
    expect(pzSectionForPath('/price-i-obicaji/teme/vino/')).toBe('/price-i-obicaji/')
    expect(pzSectionForPath('/o-projektu/')).toBe('/o-projektu/')
    expect(pzSectionForPath('')).toBeNull()
  })
})
