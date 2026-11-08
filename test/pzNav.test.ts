import { describe, expect, it } from 'vitest'
import { pzSectionForPath, pzTabForPath, pzTabs } from '../shared/utils/pzNav'

describe('pzNav tabs', () => {
  it('has the four tabs in order', () => {
    expect(pzTabs.map(tab => tab.label)).toEqual(['Početna', 'Igre', 'Istraži', 'Doprinesi'])
    expect(pzTabs.map(tab => tab.icon)).toEqual(['i-lucide-house', 'i-lucide-gamepad', 'i-lucide-compass', 'i-lucide-pen-line'])
  })

  it.each([
    ['/potkalnicko-prigorje', 'home'],
    ['/potkalnicko-prigorje/', 'home'],
    ['/potkalnicko-prigorje/igre', 'games'],
    ['/potkalnicko-prigorje/igre/kviz', 'games'],
    ['/potkalnicko-prigorje/uci', 'games'],
    ['/potkalnicko-prigorje/istrazi', 'explore'],
    ['/potkalnicko-prigorje/istrazi/opcina-kalnik', 'explore'],
    ['/potkalnicko-prigorje/bastina/kalnik/crkva', 'explore'],
    ['/potkalnicko-prigorje/govor/hiza', 'explore'],
    ['/potkalnicko-prigorje/price-i-obicaji', 'explore'],
    ['/potkalnicko-prigorje/price-i-obicaji/obicaj/martinje', 'explore'],
    ['/potkalnicko-prigorje/price-i-obicaji/kazivac/kazivacica-r-1938', 'explore'],
    ['/potkalnicko-prigorje/naselja/kalnik', 'explore'],
    ['/potkalnicko-prigorje/doprinesi', 'contribute'],
    ['/potkalnicko-prigorje/doprinesi?x=1#a', 'contribute']
  ])('marks %s as %s', (path, tab) => {
    expect(pzTabForPath(path)).toBe(tab)
  })

  it.each(['/potkalnicko-prigorje/o-projektu', '/potkalnicko-prigorje/privatnost', '/potkalnicko-prigorje/izazov/abc', '/'])('marks no tab on %s', (path) => {
    expect(pzTabForPath(path)).toBeNull()
  })

  it('maps pages to the seven header sections', () => {
    expect(pzSectionForPath('/potkalnicko-prigorje/igre/kviz')).toBe('/potkalnicko-prigorje/igre')
    expect(pzSectionForPath('/potkalnicko-prigorje/istrazi/opcina-kalnik')).toBe('/potkalnicko-prigorje/istrazi')
    expect(pzSectionForPath('/potkalnicko-prigorje/naselja/kalnik')).toBe('/potkalnicko-prigorje/istrazi')
    expect(pzSectionForPath('/potkalnicko-prigorje/bastina/kalnik/crkva')).toBe('/potkalnicko-prigorje/bastina')
    expect(pzSectionForPath('/potkalnicko-prigorje/govor')).toBe('/potkalnicko-prigorje/govor')
    expect(pzSectionForPath('/potkalnicko-prigorje/price-i-obicaji/tema/vino')).toBe('/potkalnicko-prigorje/price-i-obicaji')
    expect(pzSectionForPath('/potkalnicko-prigorje/o-projektu')).toBe('/potkalnicko-prigorje/o-projektu')
    expect(pzSectionForPath('/potkalnicko-prigorje')).toBeNull()
  })
})
