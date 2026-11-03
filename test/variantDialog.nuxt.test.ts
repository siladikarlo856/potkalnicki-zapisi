import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import VariantDialog from '../app/components/heritage/VariantDialog.vue'
import sampleWords from './fixtures/heritage/words.json'

const word = sampleWords[0]!
const posted: Record<string, unknown>[] = []
let failWith: { statusCode: number } | undefined

// registerEndpoint's h3 hands the handler a web-backed event, so the body is read from its request.
registerEndpoint('/api/submissions', {
  method: 'POST',
  handler: async (event) => {
    if (failWith) throw createError({ statusCode: failWith.statusCode, statusMessage: 'Failed' })
    posted.push(await (event as unknown as { web: { request: Request } }).web.request.json())
    return { ok: true }
  }
})
registerEndpoint('/api/places', () => ({
  version: 'test',
  places: [{ id: 'geonames:3186886', name: 'Zagreb', municipality: 'Grad Zagreb', county: 'Grad Zagreb' }]
}))

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  posted.length = 0
  failWith = undefined
})

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
const field = <T extends HTMLElement>(selector: string) => dialog()!.querySelector<T>(selector)!
const button = (label: string) => [...dialog()!.querySelectorAll('button')].find(item => item.textContent?.trim() === label)!

async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

async function open(props: { open?: boolean } = {}) {
  wrapper = await mountSuspended(VariantDialog, { props: { entry: word, open: true, ...props }, attachTo: document.body })
  await vi.waitFor(() => expect(dialog()).not.toBeNull())
  return wrapper
}

async function choosePlace() {
  field<HTMLInputElement>('[role="combobox"]').focus()
  await type(field<HTMLInputElement>('[role="combobox"]'), 'Zag')
  await vi.waitFor(() => expect(dialog()!.querySelector('[role="option"]')).not.toBeNull())
  dialog()!.querySelector<HTMLElement>('[role="option"]')!.click()
  await nextTick()
}

async function fillRequired() {
  await choosePlace()
  await type(field<HTMLInputElement>('input[name="variant"]'), 'kruh')
  field<HTMLInputElement>('[role="checkbox"], input[type="checkbox"]').click()
  await nextTick()
}

describe('variant dialog', () => {
  it('opens as a labelled dialog showing the word read-only, with focus on the first field', async () => {
    await open()
    const root = dialog()!
    expect(root.getAttribute('aria-labelledby')).toBeTruthy()
    expect(root.textContent).toContain('Kako se to kaže kod nas?')
    const shown = root.querySelector('[data-testid="variant-dialog-word"]')!
    expect(shown.textContent).toContain(word.headword)
    expect(shown.textContent).toContain(word.meaning.hr)
    expect(shown.querySelector('input, textarea')).toBeNull()
    await vi.waitFor(() => expect(document.activeElement).toBe(field('input[name="variant"]')))
    for (const label of ['Kako se to kaže kod vas?', 'Gdje se tako govori?', 'Primjer rečenice (neobavezno)', 'Tvoje ime (neobavezno)', 'Kontakt (neobavezno)']) {
      expect(root.textContent).toContain(label)
    }
  })

  it('closes on Escape', async () => {
    await open()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(dialog()).toBeNull())
  })

  it('requires the local form and the consent, and sends nothing until both are given', async () => {
    await open()
    button('Pošalji').click()
    await vi.waitFor(() => expect(dialog()!.textContent).toContain('Upiši kako se ova riječ kaže kod vas.'))
    expect(dialog()!.textContent).toContain('Bez tvog pristanka prilog ne možemo poslati.')
    expect(field('input[name="variant"]').getAttribute('aria-invalid')).toBe('true')
    expect(posted).toHaveLength(0)
  })

  it('requires a selected place even when the variant and consent are given', async () => {
    await open()
    await type(field<HTMLInputElement>('input[name="variant"]'), 'kruh')
    field<HTMLInputElement>('[role="checkbox"], input[type="checkbox"]').click()
    button('Pošalji').click()
    await vi.waitFor(() => expect(dialog()!.textContent).toContain('Odaberi mjesto gdje se tako govori.'))
    expect(field('[role="combobox"]').getAttribute('aria-invalid')).toBe('true')
    expect(dialog()!.textContent).not.toContain('Gdje se tako govori? (neobavezno)')
    expect(dialog()!.textContent).not.toContain('nastavi bez mjesta')
    expect(posted).toHaveLength(0)
    await choosePlace()
    expect(dialog()!.textContent).not.toContain('Odaberi mjesto gdje se tako govori.')
    button('Pošalji').click()
    await vi.waitFor(() => expect(posted).toHaveLength(1))
  })

  it('sends the word-referencing payload and then thanks the visitor', async () => {
    await open()
    await fillRequired()
    await type(field<HTMLTextAreaElement>('textarea'), 'Daj mi kruh.')
    await type(field<HTMLInputElement>('input[name="name"], input[autocomplete="name"]'), 'Ana')
    button('Pošalji').click()
    await vi.waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({
      text: `Umjesto „${word.headword}“ kod nas se kaže: kruh\nPrimjer: Daj mi kruh.`,
      type: 'word',
      reportKind: 'variant',
      placeId: 'geonames:3186886',
      name: 'Ana',
      consentPublish: true,
      locale: 'hr'
    })
    await vi.waitFor(() => expect(dialog()!.textContent).toContain('Hvala, prilog je stigao!'))
    expect(dialog()!.querySelector('form')).toBeNull()
    expect(dialog()!.querySelector('[data-testid="variant-dialog-word"]')!.textContent).toContain(word.headword)
    await vi.waitFor(() => expect(document.activeElement).toBe(button('Zatvori')))
    button('Zatvori').click()
    await vi.waitFor(() => expect(dialog()).toBeNull())
  })

  it('omits the example line when there is no example and starts clean when reopened', async () => {
    const page = await open()
    await fillRequired()
    button('Pošalji').click()
    await vi.waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]!.text).toBe(`Umjesto „${word.headword}“ kod nas se kaže: kruh`)
    await page.setProps({ open: false })
    await vi.waitFor(() => expect(dialog()).toBeNull())
    await page.setProps({ open: true })
    await vi.waitFor(() => expect(dialog()).not.toBeNull())
    expect(field<HTMLInputElement>('input[name="variant"]').value).toBe('')
    expect(dialog()!.textContent).not.toContain('Hvala, prilog je stigao!')
  })

  it('keeps what was typed and explains a failed send', async () => {
    await open()
    await fillRequired()
    failWith = { statusCode: 429 }
    button('Pošalji').click()
    await vi.waitFor(() => expect(dialog()!.querySelector('[role="alert"]')?.textContent).toContain('Stiglo je puno prijava'))
    expect(field<HTMLInputElement>('input[name="variant"]').value).toBe('kruh')
  })
})
