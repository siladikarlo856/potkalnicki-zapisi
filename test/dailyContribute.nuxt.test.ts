import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { useNuxtApp } from '#imports'
import DailyContribute from '../app/components/heritage/DailyContribute.vue'

// A fixture word id: nothing here depends on how real word ids look.
const WORD_ID = 'fixture-word-1'

const posted: Record<string, unknown>[] = []
let failWith: { statusCode: number, data?: unknown } | undefined
registerEndpoint('/api/submissions', {
  method: 'POST',
  handler: async (event) => {
    if (failWith) throw createError({ statusCode: failWith.statusCode, statusMessage: 'Failed', data: failWith.data })
    posted.push(await (event as unknown as { web: { request: Request } }).web.request.json())
    return { ok: true }
  }
})
registerEndpoint('/api/places', () => ({
  version: 'test',
  places: [{ id: 'geonames:3194024', name: 'Sveti Petar Orehovec', municipality: 'Sveti Petar Orehovec', county: 'Koprivničko-križevačka' }]
}))

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
const root = () => wrapper!.element as HTMLElement
const form = () => root().querySelector<HTMLElement>('[data-testid="daily-contribute-form"]')
const field = <T extends HTMLElement>(selector: string) => form()!.querySelector<T>(selector)!
const button = (label: string) => [...form()!.querySelectorAll('button')].find(item => item.textContent?.trim() === label)!

async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

// Mounted with the props /rijec-dana/ passes once the word is revealed.
async function mountFinished() {
  await useNuxtApp().$i18n.setLocale('hr')
  wrapper = await mountSuspended(DailyContribute, { props: { wordId: WORD_ID, headword: 'hiža' }, attachTo: document.body })
  return wrapper
}
async function finish() {
  await vi.waitFor(() => expect(wrapper!.find('[data-testid="daily-contribute"]').exists()).toBe(true))
}
async function choosePlace() {
  const input = field<HTMLInputElement>('[role="combobox"]')
  input.focus()
  vi.useFakeTimers()
  try {
    await type(input, 'Sveti')
    await vi.advanceTimersByTimeAsync(300)
  } finally {
    vi.useRealTimers()
  }
  const option = form()!.querySelector<HTMLElement>('[role="option"]')
  expect(option).not.toBeNull()
  option!.click()
  await nextTick()
}
async function consent() {
  field<HTMLInputElement>('[role="checkbox"], input[type="checkbox"]').click()
  await nextTick()
}

afterEach(() => {
  vi.useRealTimers()
  wrapper?.unmount()
  wrapper = undefined
  posted.length = 0
  failWith = undefined
})

describe('contributions from the daily word', () => {
  it('offers the variant and usage buttons, with no form open', async () => {
    const page = await mountFinished()
    await finish()
    const buttons = page.get('[data-testid="daily-contribute"]')
    expect(buttons.get('[data-testid="daily-contribute-variant"]').text()).toBe('Kod nas se kaže drugačije')
    expect(buttons.get('[data-testid="daily-contribute-usage"]').text()).toBe('I u mom mjestu se tako kaže')
    expect(form()).toBeNull()
  })

  it('opens the variant form with the usual prefill and sends the word link without requiring a place', async () => {
    const page = await mountFinished()
    await finish()
    await page.get('[data-testid="daily-contribute-variant"]').trigger('click')
    expect(page.get('[data-testid="daily-contribute-variant"]').attributes('aria-expanded')).toBe('true')
    await vi.waitFor(() => expect(field<HTMLTextAreaElement>('textarea').value).toBe('Umjesto „hiža“ kod nas se kaže: '))
    expect(form()!.textContent).toContain('Gdje se tako govori? (nije obavezno)')
    await type(field<HTMLTextAreaElement>('textarea'), 'Umjesto „hiža“ kod nas se kaže: kuća')
    await consent()
    button('Pošalji').click()
    await vi.waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({ type: 'word', wordId: WORD_ID, intent: 'variant', placeId: null, consentPublish: true, locale: 'hr' })
    await vi.waitFor(() => expect(form()!.textContent).toContain('Hvala, prilog je stigao!'))
  })

  it('opens the usage form prefilled, requires the place and sends the intent with the word', async () => {
    const page = await mountFinished()
    await finish()
    await page.get('[data-testid="daily-contribute-usage"]').trigger('click')
    await vi.waitFor(() => expect(field<HTMLTextAreaElement>('textarea').value).toBe('„hiža“ kaže se i u mom mjestu.'))
    expect(form()!.textContent).toContain('U kojem se mjestu tako kaže?')
    expect(form()!.textContent).not.toContain('Gdje se tako govori? (nije obavezno)')
    await consent()
    button('Pošalji').click()
    await vi.waitFor(() => expect(form()!.textContent).toContain('Odaberi mjesto u kojem se riječ tako kaže.'))
    expect(posted).toHaveLength(0)
    await choosePlace()
    button('Pošalji').click()
    await vi.waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({ text: '„hiža“ kaže se i u mom mjestu.', type: 'word', wordId: WORD_ID, intent: 'usage', placeId: 'geonames:3194024', consentPublish: true })
    await vi.waitFor(() => expect(form()!.textContent).toContain('Hvala, prilog je stigao!'))
  })

  it('switches between the two forms and closes the open one', async () => {
    const page = await mountFinished()
    await finish()
    await page.get('[data-testid="daily-contribute-usage"]').trigger('click')
    await vi.waitFor(() => expect(field<HTMLTextAreaElement>('textarea').value).toContain('kaže se i u mom mjestu'))
    await page.get('[data-testid="daily-contribute-variant"]').trigger('click')
    await vi.waitFor(() => expect(field<HTMLTextAreaElement>('textarea').value).toBe('Umjesto „hiža“ kod nas se kaže: '))
    expect(page.get('[data-testid="daily-contribute-usage"]').attributes('aria-expanded')).toBe('false')
    button('Zatvori obrazac').click()
    await vi.waitFor(() => expect(form()).toBeNull())
    await vi.waitFor(() => expect(document.activeElement).toBe(page.get('[data-testid="daily-contribute-variant"]').element))
  })

  it('says the word is gone when the server no longer has it, and keeps what was typed', async () => {
    const page = await mountFinished()
    await finish()
    await page.get('[data-testid="daily-contribute-usage"]').trigger('click')
    await vi.waitFor(() => expect(form()).not.toBeNull())
    await consent()
    await choosePlace()
    failWith = { statusCode: 400, data: { issues: [{ field: 'wordId', code: 'invalid', message: 'x' }] } }
    button('Pošalji').click()
    await vi.waitFor(() => expect(form()!.textContent).toContain('Ova riječ više nije dostupna'))
    expect(field<HTMLTextAreaElement>('textarea').value).toBe('„hiža“ kaže se i u mom mjestu.')
  })
})
