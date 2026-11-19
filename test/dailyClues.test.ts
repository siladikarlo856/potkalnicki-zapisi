import { describe, expect, it } from 'vitest'
import { typedClueLines } from '../app/utils/dailyClues'
import type { DailyWordPayload } from '../shared/utils/dailyWord'

function word(): Pick<DailyWordPayload, 'entry' | 'areas'> {
  return {
    entry: {
      id: 'skrlak', headword: 'škrlak', meaning: { hr: 'šešir' }, partOfSpeech: 'imenica', category: 'clothing', status: 'verified', sources: [],
      examples: [{ text: 'V nedelju nosi škrlak.' }],
      variants: [{ id: 'v1', form: 'klobuk', status: 'community', usages: [] }]
    },
    areas: []
  }
}
const t = () => 'odjeća'

describe('typed daily clues', () => {
  it('builds meaning clues independently of multiple-choice clues and usage examples', () => {
    expect(typedClueLines(t, word())).toEqual(['Znači: šešir', 'Odjeća.', 'Vrsta riječi: imenica.'])
  })

  it('excludes headwords and variants in every clue source after folding case and diacritics', () => {
    const payload = word()
    payload.entry.meaning.hr = 'SKRLAK'
    payload.entry.partOfSpeech = 'KLOBuk'
    payload.areas = [{ id: 'a', name: 'Škrlak', kind: 'settlement', parentId: null }]
    payload.entry.variants[0]!.usages = [{ areaId: 'a', confidence: 'reported' }]
    expect(typedClueLines(t, payload)).toEqual(['Odjeća.'])
    expect(typedClueLines(() => 'klobuk', payload)).toEqual(['□□□□□□'])
  })

  it('does not mistake a short answer inside a different word for an answer disclosure', () => {
    const payload = word()
    payload.entry.headword = 'i'
    payload.entry.variants = []
    expect(typedClueLines(t, payload)).toContain('Vrsta riječi: imenica.')
    payload.entry.meaning.hr = 'I šešir'
    expect(typedClueLines(t, payload)).not.toContain('Znači: I šešir')
  })
})
