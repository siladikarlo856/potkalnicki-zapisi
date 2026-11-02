import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import ReviewWords from '../app/pages/admin/rijeci.vue'
import WordEditor from '../app/components/heritage/WordEditor.vue'
import DailyAdmin from '../app/components/heritage/DailyAdmin.vue'
import type { DailyAdminOverview } from '../shared/utils/dailyAdmin'
import { validateWord } from '../shared/utils/word'
import Review from '../app/pages/admin/prilozi.vue'
import sampleWords from '../content/heritage/words.json'
import sampleAreas from '../content/heritage/areas.json'

const word = sampleWords[0]!
const submission = {
  id: 7, text: 'Moja riječ', type: null, targetRef: null, place: null, placeId: null, name: null, contact: null,
  locale: 'hr', consentPublish: true, consentVersion: 'v1', status: 'pending', createdAt: '2026-10-30 10:00:00'
}

registerEndpoint('/api/review/words', () => [{
  entry: word, areas: sampleAreas, active: true, submissionId: null, submissionPlace: null, createdAt: '2026-10-30', updatedAt: '2026-10-30'
}])
registerEndpoint('/api/review/submissions', () => [submission])

const pinned = { day: '2030-05-12', wordId: 'gone', headword: 'stara', active: false, source: 'pinned' as const, village: 'none', resolved: false, resolvedAt: null, replacedWordIds: [] }
const dailyOverview: DailyAdminOverview = {
  day: '2030-05-10',
  today: { ...pinned, day: '2030-05-10', wordId: word.id, headword: word.headword, active: true, source: 'auto', village: 'auto', resolved: true, resolvedAt: '2030-05-10T05:00:00.000Z' },
  recent: [{ ...pinned, day: '2030-05-09', wordId: 'prije', headword: 'jučerašnja', active: true, source: 'auto', village: 'auto', resolved: true, resolvedAt: '2030-05-09T05:00:00.000Z' }],
  pins: [pinned],
  runway: { readyUnused: 2, unused: 5, active: 9, daysLeft: 6 },
  warnings: [{ code: 'runway-short', message: 'Zaliha riječi: samo 6 dana bez ponavljanja.' }, { code: 'pin-inactive', message: 'Prikvačena riječ „stara“ nije aktivna.', day: '2030-05-12', wordId: 'gone' }]
}
const dailyCalls: Array<{ method: string, url: string, body?: unknown }> = []
registerEndpoint('/api/review/daily', () => dailyOverview)
registerEndpoint('/api/review/daily/2030-05-14', {
  method: 'PUT',
  handler: async (event) => {
    dailyCalls.push({ method: 'PUT', url: event.path.replace(/^\/_/, ''), body: await (event as unknown as { web: { request: Request } }).web.request.json() })
    const warning = { code: 'previously-used' as const, message: 'Riječ već je bila riječ dana (2030-05-01). Ponavljanje je dopušteno.', day: '2030-05-14', wordId: word.id }
    dailyOverview.warnings = [...dailyOverview.warnings, warning]
    return { day: '2030-05-14', wordId: word.id, headword: word.headword, village: 'auto', source: 'pinned', warnings: [warning] }
  }
})
registerEndpoint('/api/review/daily/2030-05-12', {
  method: 'DELETE',
  handler: (event) => {
    dailyCalls.push({ method: 'DELETE', url: event.path.replace(/^\/_/, '') })
    return { day: '2030-05-12', removed: true }
  }
})

describe('admin tables', () => {
  for (const [name, page, label] of [['submissions', Review, 'Moja riječ']] as const) {
    it(`${name}: row click and info button toggle the expanded row`, async () => {
      const wrapper = await mountSuspended(page)
      await vi.waitFor(() => expect(wrapper.text()).toContain(label))
      const info = wrapper.find('button[aria-label^="Detalji"]')
      expect(info.attributes('aria-expanded')).toBe('false')
      await info.trigger('click')
      expect(wrapper.find('button[aria-label^="Detalji"]').attributes('aria-expanded')).toBe('true')
      expect(wrapper.findAll('tbody tr')).toHaveLength(2)
      await info.trigger('click')
      expect(wrapper.findAll('tbody tr')).toHaveLength(1)
      await wrapper.find('tbody tr').trigger('click')
      expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    })
  }

  it('words: row click opens a sidebar, info button and Escape behave', async () => {
    const wrapper = await mountSuspended(ReviewWords, { attachTo: document.body })
    await vi.waitFor(() => expect(wrapper.text()).toContain(word.headword))
    await wrapper.find('button[aria-label^="Detalji"]').trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    await wrapper.find('tbody tr').trigger('click')
    await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain(word.meaning.hr))
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    document.body.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')).toBeNull())
    wrapper.unmount()
  })

  it('words: the table shows a daily-word readiness badge', async () => {
    const wrapper = await mountSuspended(ReviewWords)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Riječ dana: nedostaje'))
    expect(wrapper.text()).toContain('kategorija')
  })

  it('word editor: round-trips category, note and hand-written distractors', async () => {
    const input = validateWord({
      entry: { ...word, category: 'house', note: { hr: 'Bilješka', en: 'Note' }, distractors: [{ hr: 'jedan', en: 'one' }] },
      areas: sampleAreas, active: true
    }, word.id).value
    const wrapper = await mountSuspended(WordEditor, { props: { modelValue: input, busy: false } })
    const values = wrapper.findAll('textarea, input').map(el => (el.element as HTMLInputElement).value)
    expect(values).toEqual(expect.arrayContaining(['Bilješka', 'Note', 'jedan', 'one']))
    expect(wrapper.text()).toContain('nešto u kući')

    const note = wrapper.findAll('textarea').find(el => (el.element as HTMLTextAreaElement).value === 'Bilješka')!
    await note.setValue('Nova bilješka')
    await wrapper.findAll('input').find(el => (el.element as HTMLInputElement).value === 'jedan')!.setValue('drugi')
    await wrapper.findAll('button').find(b => b.text().startsWith('Dodaj netočan odgovor'))!.trigger('click')
    expect(input.entry.note).toEqual({ hr: 'Nova bilješka', en: 'Note' })
    expect(input.entry.category).toBe('house')
    expect(input.entry.distractors).toEqual([{ hr: 'drugi', en: 'one' }, { hr: '' }])
    expect(validateWord(JSON.parse(JSON.stringify(input)), word.id).issues.length).toBeGreaterThan(0)
  })

  it('words: the Riječ dana card shows the schedule, runway and warnings above the table', async () => {
    const wrapper = await mountSuspended(ReviewWords)
    await vi.waitFor(() => expect(wrapper.find('[data-test="daily-today"]').exists()).toBe(true))
    expect(wrapper.find('[data-test="daily-today"]').text()).toContain(`Danas (2030-05-10): ${word.headword}`)
    expect(wrapper.find('[data-test="daily-today"]').text()).toContain('automatski odabrano')
    const runway = wrapper.find('[data-test="daily-runway"]').text()
    expect(runway).toContain('Spremne neiskorištene riječi 2')
    expect(runway).toContain('Aktivne riječi 9')
    expect(runway).toContain('Dana bez ponavljanja 6')
    expect(wrapper.text()).toContain('Zaliha riječi: samo 6 dana bez ponavljanja.')
    expect(wrapper.text()).toContain('stara')
    expect(wrapper.text()).toContain('bez oznake mjesta')
    const card = wrapper.find('#rijec-dana')
    expect(card.exists()).toBe(true)
    expect(wrapper.find('table').element.compareDocumentPosition(card.element) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('words: the per-word pin action fills the form and pins the word for a chosen future day', async () => {
    dailyCalls.length = 0
    const wrapper = await mountSuspended(ReviewWords)
    await vi.waitFor(() => expect(wrapper.text()).toContain(word.headword))
    await vi.waitFor(() => expect(wrapper.find('[data-test="daily-today"]').exists()).toBe(true))
    await wrapper.find('button[aria-label^="Detalji"]').trigger('click')
    const pinAction = wrapper.findAll('button').find(b => b.text() === 'Prikvači za datum')!
    expect(pinAction.attributes('disabled')).toBeUndefined()
    await pinAction.trigger('click')

    const submit = wrapper.findAll('button').find(b => b.text() === 'Prikvači')!
    expect(submit.attributes('disabled')).toBeDefined()
    const date = wrapper.find('input[type="date"]')
    expect(date.attributes('min')).toBe('2030-05-11')
    await date.setValue('2030-05-14')
    await vi.waitFor(() => expect(wrapper.findAll('button').find(b => b.text() === 'Prikvači')!.attributes('disabled')).toBeUndefined())
    await wrapper.find('form').trigger('submit')

    await vi.waitFor(() => expect(dailyCalls, wrapper.text()).toEqual([{ method: 'PUT', url: '/api/review/daily/2030-05-14', body: { wordId: word.id, village: 'auto' } }]))
    await vi.waitFor(() => expect(wrapper.text()).toContain(`Riječ „${word.headword}“ prikvačena je za 2030-05-14.`))
    await vi.waitFor(() => expect(wrapper.text()).toContain('Ponavljanje je dopušteno.'))
    expect(wrapper.text().split('Ponavljanje je dopušteno.')).toHaveLength(2)
  })

  it('words: a past or out-of-range date cannot be submitted', async () => {
    dailyCalls.length = 0
    const wrapper = await mountSuspended(DailyAdmin, { props: { words: [{ entry: word, areas: sampleAreas, active: true, submissionId: null, submissionPlace: null, createdAt: '', updatedAt: '' }], request: { wordId: word.id, nonce: 1 } } })
    await vi.waitFor(() => expect(wrapper.find('input[type="date"]').exists()).toBe(true))
    for (const value of ['2030-05-10', '2030-05-09', '2031-05-12']) {
      await wrapper.find('input[type="date"]').setValue(value)
      expect(wrapper.findAll('button').find(b => b.text() === 'Prikvači')!.attributes('disabled')).toBeDefined()
    }
    await wrapper.find('form').trigger('submit')
    expect(dailyCalls).toEqual([])
  })

  it('words: inactive words offer no pin action, and a pin can be removed', async () => {
    dailyCalls.length = 0
    const wrapper = await mountSuspended(DailyAdmin, { props: { words: [] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('stara'))
    await wrapper.find('button[aria-label^="Ukloni prikvačenu riječ stara"]').trigger('click')
    await vi.waitFor(() => expect(dailyCalls).toEqual([{ method: 'DELETE', url: '/api/review/daily/2030-05-12' }]))
    await vi.waitFor(() => expect(wrapper.text()).toContain('Prikvačena riječ „stara“ uklonjena je za 2030-05-12.'))
  })
})
