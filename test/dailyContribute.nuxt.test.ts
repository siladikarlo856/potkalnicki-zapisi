import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState, useNuxtApp } from '#imports'
import { DAILY_STORAGE_KEY } from '../app/composables/useDailyProgress'
import DailyWord from '../app/components/heritage/DailyWord.vue'
import type { DailyWordPayload } from '../shared/utils/dailyWord'

// A fixture word id: nothing here depends on how real word ids look.
const WORD_ID = 'fixture-word-1'

function payload(): DailyWordPayload {
  return {
    day: '2026-11-11', number: 12, nextAt: new Date(Date.now() + 5 * 3_600_000).toISOString(), sample: false,
    entry: {
      id: WORD_ID, headword: 'hiža', meaning: { hr: 'kuća', en: 'house' }, partOfSpeech: 'imenica', status: 'community',
      sources: [{ id: 'editor', kind: 'editor' }], category: 'house',
      examples: [{ text: 'Idem v hižu.', translation: 'Idem u kuću.' }],
      variants: [{ id: 'v1', form: 'hiža', status: 'community', usages: [] }]
    },
    areas: [], villageAreaId: null,
    options: [
      { id: 'a', text: { hr: 'pas', en: 'dog' } },
      { id: 'b', text: { hr: 'stol', en: 'table' } },
      { id: 'c', text: { hr: 'kuća', en: 'house' } },
      { id: 'd', text: { hr: 'mlijeko' } }
    ],
    correctOptionId: 'c',
    clues: [{ kind: 'example', text: 'Idem v hižu.' }, { kind: 'category', category: 'house' }]
  }
}

const posted: Record<string, unknown>[] = []
let failWith: { statusCode: number, data?: unknown } | undefined
registerEndpoint('/api/heritage/daily', () => payload())
registerEndpoint('/api/heritage/words', () => ({ words: [], areas: [] }))
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
const stateKeys = ['heritage-daily-progress', 'heritage-daily-progress-loaded', 'heritage-daily-progress-unavailable']
const root = () => wrapper!.element as HTMLElement
const form = () => root().querySelector<HTMLElement>('[data-testid="daily-contribute-form"]')
const field = <T extends HTMLElement>(selector: string) => form()!.querySelector<T>(selector)!
const button = (label: string) => [...form()!.querySelectorAll('button')].find(item => item.textContent?.trim() === label)!

async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

async function mountFinished() {
  await useNuxtApp().$i18n.setLocale('hr')
  wrapper = await mountSuspended(DailyWord, { route: '/potkalnicko-prigorje/igre', attachTo: document.body })
  await vi.waitFor(() => expect(wrapper!.findAll('[data-option-id]').length).toBeGreaterThan(0))
  return wrapper
}
async function finish() {
  await wrapper!.get('[data-option-id="c"]').trigger('click')
  await vi.waitFor(() => expect(wrapper!.find('[data-testid="daily-contribute"]').exists()).toBe(true))
}
async function choosePlace() {
  const input = field<HTMLInputElement>('[role="combobox"]')
  input.focus()
  await type(input, 'Sveti')
  await vi.waitFor(() => expect(form()!.querySelector('[role="option"]')).not.toBeNull())
  form()!.querySelector<HTMLElement>('[role="option"]')!.click()
  await nextTick()
}
async function consent() {
  field<HTMLInputElement>('[role="checkbox"], input[type="checkbox"]').click()
  await nextTick()
}

beforeEach(() => {
  localStorage.clear()
  clearNuxtState(stateKeys)
  clearNuxtData('heritage-daily-word')
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  posted.length = 0
  failWith = undefined
})

describe('contributions from the daily word', () => {
  it('shows the two buttons only after the word is revealed, between the reveal and the share', async () => {
    const page = await mountFinished()
    expect(page.find('[data-testid="daily-contribute"]').exists()).toBe(false)
    await finish()
    const buttons = page.get('[data-testid="daily-contribute"]')
    expect(buttons.get('[data-testid="daily-contribute-variant"]').text()).toBe('Kod nas se kaže drugačije')
    expect(buttons.get('[data-testid="daily-contribute-usage"]').text()).toBe('I u mom mjestu se tako kaže')
    expect(form()).toBeNull()
    const order = [...page.element.querySelectorAll('[data-testid="daily-reveal"], [data-testid="daily-contribute"], [data-testid="daily-share"]')].map(el => el.getAttribute('data-testid'))
    expect(order).toEqual(['daily-reveal', 'daily-contribute', 'daily-share'])
  })

  it('also offers them after a missed word', async () => {
    const page = await mountFinished()
    for (const id of ['a', 'b', 'd']) await page.get(`[data-option-id="${id}"]`).trigger('click')
    await vi.waitFor(() => expect(page.find('[data-testid="daily-contribute"]').exists()).toBe(true))
  })

  it('does not offer them when the visitor played a word that has since been replaced', async () => {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({
      version: 1, days: { '2026-11-11': { wordId: 'old', guesses: ['b', 'a'], done: true, solved: true, tries: 2, maxTries: 3 } }
    }))
    await useNuxtApp().$i18n.setLocale('hr')
    const page = await mountSuspended(DailyWord, { route: '/potkalnicko-prigorje/igre' })
    wrapper = page
    await vi.waitFor(() => expect(page.find('[data-testid="daily-replaced"]').exists()).toBe(true))
    expect(page.find('[data-testid="daily-contribute"]').exists()).toBe(false)
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
