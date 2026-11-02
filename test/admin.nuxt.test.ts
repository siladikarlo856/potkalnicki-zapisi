import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import ReviewWords from '../app/pages/admin/rijeci.vue'
import WordEditor from '../app/components/heritage/WordEditor.vue'
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
})
