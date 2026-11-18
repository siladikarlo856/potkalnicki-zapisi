import { describe, expect, it } from 'vitest'
import { answerAddress } from '../shared/utils/addressRedirects'

describe('learn redirects', () => {
  it('redirects legacy kartice to uci with rijeci topics', () => {
    expect(answerAddress('/igre/kartice')).toEqual({ status: 'redirect', location: '/uci/?teme=rijeci' })
    expect(answerAddress('/igre/kartice/')).toEqual({ status: 'redirect', location: '/uci/?teme=rijeci' })
  })
})
