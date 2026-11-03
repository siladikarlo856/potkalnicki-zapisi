import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { UApp } from '#components'
import AdminChallenges from '../app/pages/admin/izazovi.vue'
import type { ChallengeTemplate } from '../shared/utils/content/challengeTemplate'
import sample from '../content/heritage/challenge.json'

// The Izazovi admin (challenge templates) on the CRUD kit, against mocked API routes: the list, the
// nested round and question editor in the dialog, validation at the nested fields, and "Postavi kao
// trenutni" from the row menu.

const CURRENT = '5b0d9c5e-2b8e-8f3a-9c1d-3e4f5a6b7c8d'
const OTHER = '9e8d7c6b-5a49-4382-a170-6f5e4d3c2b1a'
const { version: _version, ...content } = sample
const current: ChallengeTemplate = {
  id: CURRENT, name: 'Izazov zavičaja — uzorak', content, isCurrent: true,
  status: 'published', revision: 1, createdAt: '2026-11-03T10:00:00.000Z', updatedAt: '2026-11-03T10:00:00.000Z'
}
const spring: ChallengeTemplate = {
  ...current, id: OTHER, name: 'Proljetni izazov', isCurrent: false, revision: 4,
  content: { ...content, sample: false, rounds: content.rounds.slice(0, 1) }
}

const calls: Array<{ method: string, path: string, body?: unknown }> = []
type WebEvent = { method: string, path: string, web: { request: Request } }
async function record(event: unknown) {
  const { method, path, web } = event as WebEvent
  const body = method === 'GET' ? undefined : await web.request.json()
  calls.push({ method, path: new URL(path.replace(/^\/_/, ''), 'http://localhost').pathname, body })
  return body
}

registerEndpoint('/api/admin/session', () => ({ authenticated: true }))
registerEndpoint('/api/admin/content/challenge_template', {
  method: 'GET',
  handler: async (event) => {
    await record(event)
    return { rows: [current, spring], total: 2, page: 1, size: 25 }
  }
})
registerEndpoint('/api/admin/content/challenge_template', {
  method: 'POST',
  handler: async (event) => {
    const body = await record(event)
    return { entity: { ...spring, ...body, id: '11111111-2222-4333-8444-555555555555', revision: 1 } }
  }
})
for (const template of [current, spring]) {
  registerEndpoint(`/api/admin/content/challenge_template/${template.id}`, {
    method: 'GET',
    handler: async (event) => {
      await record(event)
      return { entity: template, legacyIds: [] }
    }
  })
  registerEndpoint(`/api/admin/content/challenge_template/${template.id}`, {
    method: 'PATCH',
    handler: async (event) => {
      const body = await record(event)
      return { entity: { ...template, ...body, revision: body.revision + 1 } }
    }
  })
}

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  calls.length = 0
  await useRouter().replace({ query: {} })
})

function mountPage(route = '/admin/izazovi') {
  return mountSuspended({ setup: () => () => h(UApp, null, { default: () => h(AdminChallenges) }) }, { attachTo: document.body, route })
}
const menuItems = () => [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')]
const openMenu = (label: string) => document.body.querySelector<HTMLButtonElement>(`button[aria-label="Radnje: ${label}"]`)!.click()

const dialogs = () => [...document.body.querySelectorAll<HTMLElement>('[role="dialog"]')]
const dialog = () => dialogs().at(-1)
const buttonIn = (root: ParentNode | undefined, label: string) =>
  [...(root?.querySelectorAll('button') ?? [])].find(item => item.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined
const patches = () => calls.filter(call => call.method === 'PATCH')

async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

describe('admin challenge templates (Izazovi)', () => {
  it('lists templates with the current one marked and a round and question summary', async () => {
    wrapper = await mountPage()
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Proljetni izazov'))
    const rows = [...wrapper.element.querySelectorAll('tbody tr')].map(row => row.textContent ?? '')
    expect(rows[0]).toContain('Trenutni')
    expect(rows[0]).toContain('3 kruga · 15 pitanja')
    expect(rows[0]).toContain('Uzorak')
    expect(rows[1]).toContain('1 krug · 5 pitanja')
    expect(rows[1]).not.toContain('Uzorak')
  })

  it('starts a new template with one round and question, and shows problems at the nested fields', async () => {
    wrapper = await mountPage()
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Proljetni izazov'))
    buttonIn(wrapper.element, 'Novi izazov')!.click()
    await vi.waitFor(() => expect(dialog()?.querySelector('[data-test="challenge-round-0"]')).toBeTruthy())
    expect(dialog()!.querySelector('[data-test="challenge-question-0"]')).not.toBeNull()

    buttonIn(dialog(), 'Dodaj krug')!.click()
    await vi.waitFor(() => expect(dialog()!.querySelector('[data-test="challenge-round-1"]')).toBeTruthy())

    buttonIn(dialog(), 'Objavi')!.click()
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Polje „Naziv“ je obavezno.'))
    expect(dialog()!.textContent).toContain('Polje „Naslov (hrvatski)“ je obavezno.')
    expect(dialog()!.querySelector('[data-test="challenge-round-1"]')!.textContent).toContain('Polje „Tema (engleski)“ je obavezno.')
    expect(dialog()!.querySelector('[data-test="challenge-round-1"]')!.textContent).toContain('Polje „Odgovor 4 (hrvatski)“ je obavezno.')
    expect(calls.some(call => call.method === 'POST')).toBe(false)
  })

  it('edits a question in place and saves the whole set with the revision', async () => {
    wrapper = await mountPage(`/admin/izazovi?uredi=${OTHER}`)
    await vi.waitFor(() => expect(dialog()?.querySelector('[data-test="challenge-round-0"]')).toBeTruthy())
    const question = dialog()!.querySelector<HTMLElement>('[data-test="challenge-question-1"]')!
    // Complete questions start collapsed; their inputs stay mounted for validation.
    const prompt = question.querySelector<HTMLTextAreaElement>('textarea[lang="hr"]')!
    await type(prompt, 'Što znači „kaj”?')

    buttonIn(dialog(), 'Spremi')!.click()
    await vi.waitFor(() => expect(patches()).toHaveLength(1))
    const body = patches()[0]!.body as { revision: number, content: typeof content, isCurrent: boolean }
    expect(body.revision).toBe(4)
    expect(body.isCurrent).toBe(false)
    expect(body.content.rounds[0]!.questions[1]!.prompt.hr).toBe('Što znači „kaj”?')
    expect(body.content.rounds[0]!.questions.map(q => q.id)).toEqual(spring.content.rounds[0]!.questions.map(q => q.id))
  })

  it('makes a published template current from the row menu after a confirmation, and locks the current one', async () => {
    wrapper = await mountPage()
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Proljetni izazov'))

    openMenu('Izazov zavičaja — uzorak')
    await vi.waitFor(() => expect(menuItems().some(item => item.textContent?.includes('Obriši'))).toBe(true))
    expect(menuItems().some(item => item.textContent?.includes('Postavi kao trenutni'))).toBe(false)
    const deleteItem = menuItems().find(item => item.textContent?.includes('Obriši'))!
    expect(deleteItem.hasAttribute('data-disabled')).toBe(true)
    expect(deleteItem.textContent).toContain('Najprije postavi drugi izazov kao trenutni.')
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(menuItems()).toHaveLength(0))

    openMenu('Proljetni izazov')
    await vi.waitFor(() => expect(menuItems().some(item => item.textContent?.includes('Postavi kao trenutni'))).toBe(true))
    const item = menuItems().find(entry => entry.textContent?.includes('Postavi kao trenutni'))!
    item.click()
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Postaviti „Proljetni izazov” kao trenutni izazov?'))
    buttonIn(dialog(), 'Postavi kao trenutni')!.click()
    await vi.waitFor(() => expect(patches()).toHaveLength(1))
    expect(patches()[0]).toMatchObject({ path: `/api/admin/content/challenge_template/${OTHER}`, body: { isCurrent: true, revision: 4 } })
  })
})
