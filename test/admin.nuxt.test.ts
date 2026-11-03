import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import ReviewWords from '../app/pages/admin/rijeci.vue'
import WordEditor from '../app/components/heritage/WordEditor.vue'
import DailyAdmin from '../app/components/heritage/DailyAdmin.vue'
import { validateWord } from '../shared/utils/word'
import type { DailyAdminOverview } from '../shared/utils/dailyAdmin'
import Review from '../app/pages/admin/prilozi.vue'
import sampleWords from '../content/heritage/words.json'
import sampleAreas from '../content/heritage/areas.json'

const word = sampleWords[0]!
const submission = {
  id: 7, text: 'Moja riječ', type: null, targetRef: null, place: null, placeId: null, name: null, contact: null,
  locale: 'hr', consentPublish: true, consentVersion: 'v1', status: 'pending', createdAt: '2026-10-30 10:00:00'
}

const adminWord = {
  id: word.id,
  entry: word,
  areas: sampleAreas,
  status: 'published' as const,
  headword: word.headword,
  meaningHr: word.meaning.hr,
  entryStatus: word.status,
  slug: 'hiza',
  submissionId: null,
  submissionPlace: null,
  revision: 1,
  createdAt: '2026-10-30T00:00:00.000Z',
  updatedAt: '2026-10-30T00:00:00.000Z'
}

registerEndpoint('/api/review/areas', () => sampleAreas)
registerEndpoint('/api/admin/content/word', () => ({ rows: [adminWord], total: 1, page: 1, size: 25 }))
registerEndpoint(`/api/admin/content/word/${word.id}`, () => ({ entity: adminWord, legacyIds: [] }))
let submissionRows: Array<Record<string, unknown>> = [submission]
registerEndpoint('/api/review/submissions', () => submissionRows)

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

describe('admin submissions linked to a word', () => {
  const linked = { ...submission, wordId: 'fixture-word-1', wordHeadword: 'hiža', placeId: 'geonames:3194024', place: 'Sveti Petar Orehovec', placeContext: 'Sveti Petar Orehovec · Koprivničko-križevačka', placeCatalogVersion: 'test' }
  const usage = { ...linked, id: 21, text: 'Usage confirmation', intent: 'usage' }
  const variant = { ...linked, id: 22, text: 'Variant form', intent: 'variant' }

  it('shows the linked word and intent, links to the word editor and hides promotion for a usage', async () => {
    submissionRows = [usage, variant, { ...submission, id: 23, text: 'Plain one' }]
    try {
      const wrapper = await mountSuspended(Review)
      await vi.waitFor(() => expect(wrapper.text()).toContain('Usage confirmation'))
      // Badges next to the text, so the editor sees the kind without opening the row.
      expect(wrapper.text()).toContain('Potvrda upotrebe')
      expect(wrapper.text()).toContain('Drugačiji oblik')
      for (const info of wrapper.findAll('button[aria-label^="Detalji"]')) await info.trigger('click')
      const links = wrapper.findAll('[data-testid="submission-word"]')
      expect(links).toHaveLength(2)
      expect(links[0]!.text()).toBe('hiža · Potvrda upotrebe')
      expect(links[1]!.text()).toBe('hiža · Drugačiji oblik')
      expect(links[0]!.get('a').attributes('href')).toBe('/admin/rijeci?uredi=fixture-word-1')
      const promote = wrapper.findAll('button').filter(button => button.text() === 'Dodaj u riječi / otvori skicu')
      // A variant (and the plain row) can still become a draft; the usage cannot.
      expect(promote).toHaveLength(2)
      expect(wrapper.findAll('[data-testid="usage-note"]')).toHaveLength(1)
      expect(wrapper.get('[data-testid="usage-note"]').text()).toContain('ne pretvara u novu skicu')
    } finally {
      submissionRows = [submission]
    }
  })

  it('falls back to the word id when the headword is unknown and shows nothing for an unlinked row', async () => {
    submissionRows = [{ ...usage, wordHeadword: null }, { ...submission, id: 24, text: 'Unlinked' }]
    try {
      const wrapper = await mountSuspended(Review)
      await vi.waitFor(() => expect(wrapper.text()).toContain('Usage confirmation'))
      for (const info of wrapper.findAll('button[aria-label^="Detalji"]')) await info.trigger('click')
      expect(wrapper.findAll('[data-testid="submission-word"]')).toHaveLength(1)
      expect(wrapper.get('[data-testid="submission-word"]').text()).toContain('fixture-word-1')
    } finally {
      submissionRows = [submission]
    }
  })
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

  it('words: the table shows a daily-word readiness badge for active rows', async () => {
    const wrapper = await mountSuspended(ReviewWords, { route: '/admin/rijeci' })
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
