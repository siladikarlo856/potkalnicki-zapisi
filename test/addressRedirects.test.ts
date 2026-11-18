import { describe, expect, it } from 'vitest'
import { answerAddress } from '../shared/utils/addressRedirects'

const redirect = (location: string) => ({ status: 'redirect', location })
const ok = { status: 'ok' }

describe('address changes (10-layout-and-navigation.md, section 1)', () => {
  it.each([
    ['/potkalnicko-prigorje', '/'],
    ['/potkalnicko-prigorje/', '/'],
    ['/potkalnicko-prigorje/istrazi', '/mjesta/'],
    ['/potkalnicko-prigorje/istrazi/', '/mjesta/'],
    ['/potkalnicko-prigorje/istrazi/opcina-kalnik', '/mjesta/opcina-kalnik/'],
    ['/potkalnicko-prigorje/istrazi/opcina-kalnik/', '/mjesta/opcina-kalnik/'],
    ['/potkalnicko-prigorje/bastina', '/bastina/'],
    ['/potkalnicko-prigorje/bastina/kalnik/crkva-sv-brcka', '/bastina/kalnik/crkva-sv-brcka/'],
    ['/potkalnicko-prigorje/price-i-obicaji', '/price-i-obicaji/'],
    ['/potkalnicko-prigorje/price-i-obicaji/prica/vjestica', '/price-i-obicaji/price/vjestica/'],
    ['/potkalnicko-prigorje/price-i-obicaji/obicaj/martinje', '/price-i-obicaji/obicaji/martinje/'],
    ['/potkalnicko-prigorje/price-i-obicaji/usmeni-tekst/zdravica', '/price-i-obicaji/narodni-tekstovi/zdravica/'],
    ['/potkalnicko-prigorje/price-i-obicaji/kazivac/marija', '/price-i-obicaji/kazivaci/marija/'],
    ['/potkalnicko-prigorje/price-i-obicaji/tema/vino', '/price-i-obicaji/teme/vino/'],
    ['/potkalnicko-prigorje/osobe', '/osobe/'],
    ['/potkalnicko-prigorje/osobe/ana', '/osobe/ana/'],
    ['/potkalnicko-prigorje/govor/hiza', '/govor/hiza/'],
    ['/potkalnicko-prigorje/uci/sesija', '/uci/sesija/'],
    ['/potkalnicko-prigorje/izazov/abc/ljestvica', '/izazov/abc/ljestvica/'],
    ['/potkalnicko-prigorje/doprinesi', '/doprinesi/'],
    ['/potkalnicko-prigorje/igre', '/igre/'],
    ['/potkalnicko-prigorje/igre/kviz', '/igre/kviz/'],
    ['/potkalnicko-prigorje/o-projektu/fotografije', '/o-projektu/fotografije/'],
    ['/potkalnicko-prigorje/privatnost', '/privatnost/']
  ])('answers 301 for the old address %s to %s', (old, location) => {
    expect(answerAddress(old)).toEqual(redirect(location))
  })

  it('renames the sections that moved at the root as well', () => {
    expect(answerAddress('/istrazi/')).toEqual(redirect('/mjesta/'))
    expect(answerAddress('/istrazi/opcina-kalnik')).toEqual(redirect('/mjesta/opcina-kalnik/'))
    expect(answerAddress('/price-i-obicaji/kazivac/marija/')).toEqual(redirect('/price-i-obicaji/kazivaci/marija/'))
    expect(answerAddress('/price-i-obicaji/tema/vino/')).toEqual(redirect('/price-i-obicaji/teme/vino/'))
    expect(answerAddress('/price-i-obicaji/prica/vjestica/')).toEqual(redirect('/price-i-obicaji/price/vjestica/'))
  })

  it('leaves the lookup of a settlement to the server', () => {
    expect(answerAddress('/naselja/kalnik')).toEqual({ status: 'settlement', slug: 'kalnik', search: '' })
    expect(answerAddress('/potkalnicko-prigorje/naselja/kalnik/', '?x=1')).toEqual({ status: 'settlement', slug: 'kalnik', search: '?x=1' })
  })

  it('keeps the query string', () => {
    expect(answerAddress('/potkalnicko-prigorje/doprinesi', '?vrsta=sjecanje')).toEqual(redirect('/doprinesi/?vrsta=sjecanje'))
    expect(answerAddress('/uci/sesija', '?teme=rijeci&n=10')).toEqual(redirect('/uci/sesija/?teme=rijeci&n=10'))
  })

  it('renames the kind filter of the intangible list', () => {
    expect(answerAddress('/price-i-obicaji/', '?kind=obicaj&type=godisnji')).toEqual(redirect('/price-i-obicaji/?kind=obicaji&type=godisnji'))
    expect(answerAddress('/price-i-obicaji', '?kind=usmeni-tekst')).toEqual(redirect('/price-i-obicaji/?kind=narodni-tekstovi'))
    expect(answerAddress('/price-i-obicaji/', '?kind=price')).toEqual(ok)
  })

  it('moves the retired game pages to their topic filter', () => {
    expect(answerAddress('/igre/rijeci')).toEqual(redirect('/igre/?tema=rijeci'))
    expect(answerAddress('/igre/crkve/')).toEqual(redirect('/igre/?tema=bastina'))
    expect(answerAddress('/igre/zemljopis')).toEqual(redirect('/igre/?tema=mjesta'))
    expect(answerAddress('/igre/poznati-ljudi')).toEqual(redirect('/igre/?tema=osobe'))
    expect(answerAddress('/igre/legende')).toEqual(redirect('/igre/?tema=legende'))
    expect(answerAddress('/igre/povijest')).toEqual(redirect('/igre/'))
    expect(answerAddress('/igre/sport')).toEqual(redirect('/igre/'))
    expect(answerAddress('/igre/kartice', '?x=1')).toEqual(redirect('/uci/?teme=rijeci&x=1'))
    expect(answerAddress('/potkalnicko-prigorje/igre/kartice')).toEqual(redirect('/uci/?teme=rijeci'))
  })
})

describe('trailing slash', () => {
  it.each([
    ['/mjesta', '/mjesta/'],
    ['/mjesta/opcina-kalnik', '/mjesta/opcina-kalnik/'],
    ['/mjesta/opcina-kalnik/kalnik', '/mjesta/opcina-kalnik/kalnik/'],
    ['/bastina/kalnik/crkva', '/bastina/kalnik/crkva/'],
    ['/price-i-obicaji/price/vjestica', '/price-i-obicaji/price/vjestica/'],
    ['/price-i-obicaji/kazivaci/marija', '/price-i-obicaji/kazivaci/marija/'],
    ['/igre/kviz', '/igre/kviz/'],
    ['/izazov/abc/ljestvica', '/izazov/abc/ljestvica/'],
    ['/o-projektu', '/o-projektu/'],
    ['/privatnost', '/privatnost/']
  ])('answers 301 from %s to %s', (path, location) => {
    expect(answerAddress(path)).toEqual(redirect(location))
  })

  it('accepts an address that already ends in a slash', () => {
    for (const path of ['/', '/mjesta/', '/mjesta/opcina-kalnik/kalnik/', '/price-i-obicaji/teme/vino/', '/igre/', '/igre/kviz/', '/privatnost/']) {
      expect(answerAddress(path)).toEqual(ok)
    }
  })

  it('leaves the API, build files, the admin editor, the locale root and files alone', () => {
    for (const path of ['/api/atlas/overview', '/_nuxt/entry.js', '/admin', '/admin/prijava', '/en', '/sitemap.xml', '/robots.txt', '/favicon.svg', '/osobe/ana.json']) {
      expect(answerAddress(path)).toEqual(ok)
    }
  })

  it('does not redirect an unknown address, which answers 404', () => {
    for (const path of ['/missing-page', '/heritage', '/review', '/arhiv']) {
      expect(answerAddress(path)).toEqual(ok)
    }
  })

  it('never redirects to another host', () => {
    for (const path of ['/potkalnicko-prigorje//evil.com/x', '/potkalnicko-prigorje/\\evil.com', '/potkalnicko-prigorje///evil.com', '//evil.com/x', '//igre']) {
      const answer = answerAddress(path)
      if (answer.status === 'redirect') expect(answer.location.startsWith('//')).toBe(false)
    }
  })
})
