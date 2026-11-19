import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import SuggestForm from '../app/components/heritage/SuggestForm.vue'
import ErrorPage from '../app/error.vue'
import { registerAtlasApiEndpoints } from './helpers/registerAtlasApi'

registerAtlasApiEndpoints()
registerEndpoint('/api/submission-token', () => ({ token: null }))

const KEY = 'pz-contribute-draft/v1/doprinesi/proposal/word/a'
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  localStorage.clear()
})

const mountForm = (draftKey: string) => mountSuspended(SuggestForm, {
  props: { kind: 'word', mode: 'proposal', draftKey },
  attachTo: document.body
})

describe('contribution draft storage', () => {
  it('saves note, name and contact but never publish consent or the honeypot, and does not restore them', async () => {
    localStorage.setItem(KEY, JSON.stringify({
      values: {}, placeQuery: '',
      state: { note: 'bilješka', name: 'Ana', contact: 'a@b.hr', consentPublish: true, website: 'spam' }
    }))
    wrapper = await mountForm('doprinesi/proposal/word/a')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Vraćen je nedovršeni prilog'))
    const checkbox = wrapper.find('input[type="checkbox"], [role="checkbox"]')
    expect(checkbox.attributes('aria-checked') ?? (checkbox.element as HTMLInputElement).checked?.toString()).not.toBe('true')

    const note = wrapper.find('textarea')
    await note.setValue('nova bilješka')
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem(KEY)!).state.note).toBe('nova bilješka'))
    const saved = JSON.parse(localStorage.getItem(KEY)!)
    expect(Object.keys(saved.state).sort()).toEqual(['contact', 'name', 'note'])
  })

  it('keeps drafts of different targets apart', async () => {
    localStorage.setItem(KEY, JSON.stringify({ values: {}, placeQuery: '', state: { note: 'za A', name: '', contact: '' } }))
    wrapper = await mountForm('doprinesi/proposal/word/b')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(wrapper.text()).not.toContain('Vraćen je nedovršeni prilog')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).not.toBe('za A')
  })
})

describe('draft only reflects visitor input', () => {
  it('writes nothing on mount, saves after typing, and removes the draft once the form is emptied again', async () => {
    wrapper = await mountForm('doprinesi/proposal/word/a')
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(wrapper.text()).not.toContain('Vraćen je nedovršeni prilog')

    const note = wrapper.find('textarea')
    await note.setValue('nešto')
    await vi.waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull())
    await note.setValue('')
    await vi.waitFor(() => expect(localStorage.getItem(KEY)).toBeNull())
  })
})

describe('410 page copy', () => {
  it('uses generic copy without a fabricated date or reason', async () => {
    const page = await mountSuspended(ErrorPage, { props: { error: { statusCode: 410, url: '/bastina/x/y/' } as never } })
    expect(page.text()).toContain('Ovaj zapis više nije dostupan.')
    expect(page.text()).not.toMatch(/2026|povukli/)
  })
})
