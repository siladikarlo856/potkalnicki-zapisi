import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import SuggestDialog from '../app/components/heritage/SuggestDialog.vue'
import { registerAtlasApiEndpoints } from './helpers/registerAtlasApi'

registerAtlasApiEndpoints()

const posted: Record<string, unknown>[] = []
let failWith: { statusCode: number } | undefined
registerEndpoint('/api/submissions', {
  method: 'POST',
  handler: async (event) => {
    if (failWith) throw createError({ statusCode: failWith.statusCode, statusMessage: 'Failed' })
    posted.push(await (event as unknown as { web: { request: Request } }).web.request.json())
    return { ok: true }
  }
})

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  posted.length = 0
  failWith = undefined
})

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
const field = <T extends HTMLElement>(selector: string) => dialog()!.querySelector<T>(selector)!
const button = (label: string) => [...dialog()!.querySelectorAll('button')].find(item => item.textContent?.trim() === label)!

async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

async function open(props: Record<string, unknown>) {
  wrapper = await mountSuspended(SuggestDialog, { props: { open: true, ...props }, attachTo: document.body })
  await vi.waitFor(() => expect(dialog()?.querySelector('[data-testid="suggest-form"]')).not.toBeNull())
  // The form fetches its render-time token on mount; wait for it before sending.
  await new Promise(resolve => setTimeout(resolve, 50))
}

async function consent() {
  field<HTMLElement>('[role="checkbox"], input[type="checkbox"]').click()
  await nextTick()
}

const wordCorrection = {
  kind: 'word',
  mode: 'correction',
  target: { id: 'f13d74f1-67db-843e-9d87-84ca34aeda1e', label: 'hiza' },
  current: { meaningHr: 'kuća', meaningEn: 'house', partOfSpeech: 'imenica' }
}

describe('HeritageSuggestDialog', () => {
  it('starts a correction from the current values and sends only what changed, with the render-time token', async () => {
    await open(wordCorrection)
    expect(field<HTMLElement>('[data-testid="suggest-heading"]').textContent).toContain('hiza')
    expect(field<HTMLInputElement>('input[name="p.meaningHr"]').value).toBe('kuća')

    await type(field<HTMLInputElement>('input[name="p.meaningHr"]'), 'kuća, dom')
    await consent()
    button('Pošalji').click()

    await vi.waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({
      type: 'correction',
      targetKind: 'word',
      targetId: 'f13d74f1-67db-843e-9d87-84ca34aeda1e',
      payload: { meaningHr: 'kuća, dom' },
      consentPublish: true,
      formToken: 'test-token',
      locale: 'hr'
    })
    expect(posted[0]!.text).toBe('Ispravak: hiza')
    await vi.waitFor(() => expect(dialog()!.textContent).toContain('Hvala'))
  })

  it('refuses a correction that changes nothing', async () => {
    await open(wordCorrection)
    await consent()
    button('Pošalji').click()
    await vi.waitFor(() => expect(dialog()!.textContent).toContain('Promijeni barem jedno polje'))
    expect(posted).toHaveLength(0)
  })

  it('needs the required fields and the consent for a proposal', async () => {
    await open({ kind: 'source', mode: 'proposal' })
    button('Pošalji').click()
    await vi.waitFor(() => expect(dialog()!.textContent).toContain('Obavezno polje'))
    expect(posted).toHaveLength(0)
  })

  it('sends a proposal with the note as the text', async () => {
    await open({ kind: 'source', mode: 'proposal', prefill: { note: 'Uz zapis: Crkva' } })
    await type(field<HTMLInputElement>('input[name="p.title"]'), 'Knjiga o Kalniku')
    await type(field<HTMLTextAreaElement>('textarea[name="note"]'), 'Vidi stranicu 12')
    await consent()
    button('Pošalji').click()
    await vi.waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({ type: 'proposal', targetKind: 'source', payload: { title: 'Knjiga o Kalniku', note: 'Uz zapis: Crkva' }, text: 'Vidi stranicu 12' })
    expect(posted[0]).not.toHaveProperty('targetId')
  })

  it('says when there are too many suggestions', async () => {
    failWith = { statusCode: 429 }
    await open(wordCorrection)
    await type(field<HTMLInputElement>('input[name="p.meaningHr"]'), 'drugo')
    await consent()
    button('Pošalji').click()
    await vi.waitFor(() => expect(dialog()!.querySelector('[role="alert"]')).not.toBeNull())
  })

  it('opens clean every time', async () => {
    await open(wordCorrection)
    await type(field<HTMLInputElement>('input[name="p.meaningHr"]'), 'promijenjeno')
    await wrapper!.setProps({ open: false })
    await vi.waitFor(() => expect(dialog()).toBeNull())
    await wrapper!.setProps({ open: true })
    await vi.waitFor(() => expect(dialog()?.querySelector('input[name="p.meaningHr"]')).not.toBeNull())
    expect(field<HTMLInputElement>('input[name="p.meaningHr"]').value).toBe('kuća')
  })
})
