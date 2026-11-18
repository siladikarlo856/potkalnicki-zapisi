import { describe, expect, it } from 'vitest'
import { answerAddress } from '../shared/utils/addressRedirects'

describe('igre topic redirects', () => {
  it('answers 301 for the seven retired topic pages, with or without the trailing slash', () => {
    const moved: Record<string, string> = {
      'rijeci': '/igre/?tema=rijeci',
      'crkve': '/igre/?tema=bastina',
      'zemljopis': '/igre/?tema=mjesta',
      'poznati-ljudi': '/igre/?tema=osobe',
      'legende': '/igre/?tema=legende',
      'povijest': '/igre/',
      'sport': '/igre/'
    }
    for (const [slug, location] of Object.entries(moved)) {
      expect(answerAddress(`/igre/${slug}`)).toEqual({ status: 'redirect', location })
      expect(answerAddress(`/igre/${slug}/`)).toEqual({ status: 'redirect', location })
    }
  })
})
