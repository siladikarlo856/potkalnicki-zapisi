import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import SpeechIndex from '../app/pages/potkalnicko-prigorje/govor/index.vue'
import SpeechWord from '../app/pages/potkalnicko-prigorje/govor/[slug].vue'
import type { WordPageResponse } from '../shared/types/publicSpeech'
import type { PublicWords } from '../shared/utils/word'

const listPayload: PublicWords = {
  words: [
    {
      id: 'w-hiza',
      headword: 'hiža',
      meaning: { hr: 'kuća' },
      partOfSpeech: 'imenica',
      status: 'community',
      slug: 'hiza',
      variants: [{ id: 'v1', form: 'hiža', status: 'community', usages: [] }],
      sources: [{ id: 's1', kind: 'publication', credit: 'Kajkavski rječnik' }]
    },
    {
      id: 'w-kaj',
      headword: 'kaj',
      meaning: { hr: 'što' },
      partOfSpeech: 'zamjenica',
      status: 'verified',
      slug: 'kaj',
      variants: [{ id: 'v2', form: 'kaj', status: 'verified', usages: [] }],
      sources: [{ id: 's2', kind: 'publication', credit: 'Rječnik' }]
    }
  ],
  areas: []
}

const detailPayload: WordPageResponse = {
  word: listPayload.words[0]!,
  areas: [],
  related: [{ slug: 'kaj', headword: 'kaj', meaning: 'što', path: '/potkalnicko-prigorje/govor/kaj' }]
}

registerEndpoint('/api/heritage/words', () => listPayload)
registerEndpoint('/api/heritage/words/hiza', () => detailPayload)

describe('Potkalnički zapisi speech pages', () => {
  it('lists words grouped by letter with search', async () => {
    const page = await mountSuspended(SpeechIndex, { route: '/potkalnicko-prigorje/govor' })
    await vi.waitFor(() => expect(page.find('[data-testid="speech-index"]').exists()).toBe(true))
    expect(page.text()).toContain('Naš govor')
    expect(page.get('[data-testid="speech-letter-H"]').text()).toContain('hiža')
    expect(page.get('[data-testid="speech-letter-K"]').text()).toContain('kaj')
    await page.get('[data-testid="speech-search"]').setValue('kaj')
    await vi.waitFor(() => expect(page.find('[data-testid="speech-letter-H"]').exists()).toBe(false))
    expect(page.get('[data-testid="speech-letter-K"]').text()).toContain('kaj')
  })

  it('renders a word archive page with meaning, variants, related words and learn link', async () => {
    const page = await mountSuspended(SpeechWord, {
      route: { path: '/potkalnicko-prigorje/govor/hiza', params: { slug: 'hiza' } }
    })
    await vi.waitFor(() => expect(page.find('[data-testid="speech-word-page"]').exists()).toBe(true))
    expect(page.text()).toContain('hiža')
    expect(page.get('[data-testid="speech-meaning"]').text()).toBe('kuća')
    expect(page.get('[data-testid="speech-variants"]').exists()).toBe(true)
    expect(page.text()).toContain('Slične riječi')
    expect(page.text()).toContain('kaj')
    expect(page.get('[data-testid="speech-learn-word"]').attributes('href')).toContain('kartice=word:w-hiza')
    expect(page.get('[data-testid="word-suggest-correction"]').exists()).toBe(true)
  })
})
