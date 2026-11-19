import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ErrorPage from '../app/error.vue'

// Contract (design 30-states-and-accessibility, address rules of 10-layout-and-navigation): a removed
// record answers 410 with the "removed" state — heading "Ovaj je zapis uklonjen", no retry advice and
// one way forward to the list of its section; an unknown address keeps the "not found" state.
describe('error page', () => {
  it('shows the removed state for a 410 with a link back to the section list', async () => {
    const page = await mountSuspended(ErrorPage, {
      props: { error: { statusCode: 410, url: '/bastina/krizevci/stara-kapela/' } as never }
    })
    expect(page.text()).toContain('Ovaj je zapis uklonjen')
    expect(page.text()).not.toMatch(/Pokušaj ponovno|pošlo po zlu/)
    expect(page.findAll('a').find(link => link.text() === 'Na popis')?.attributes('href')).toBe('/bastina/')
  })

  it('falls back to the places list when the section is unknown', async () => {
    const page = await mountSuspended(ErrorPage, {
      props: { error: { statusCode: 410, url: '/' } as never }
    })
    expect(page.findAll('a').find(link => link.text() === 'Na popis')?.attributes('href')).toBe('/mjesta/')
  })

  it('points an old /potkalnicko-prigorje/ address of a removed settlement to the places list', async () => {
    // The old prefix 301s to the home page, so linking to it would not lead to any section list.
    const page = await mountSuspended(ErrorPage, {
      props: { error: { statusCode: 410, url: '/potkalnicko-prigorje/naselja/nestalo-selo' } as never }
    })
    expect(page.findAll('a').find(link => link.text() === 'Na popis')?.attributes('href')).toBe('/mjesta/')
  })

  it('keeps the not-found state for a 404', async () => {
    const page = await mountSuspended(ErrorPage, {
      props: { error: { statusCode: 404, url: '/nepostojeca-adresa/' } as never }
    })
    expect(page.text()).toContain('Stranica nije pronađena')
    expect(page.text()).not.toContain('Ovaj je zapis uklonjen')
  })
})
