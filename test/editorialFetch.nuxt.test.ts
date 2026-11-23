import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtState, useState } from '#imports'
import { useEditorialFetch } from '../app/composables/useEditorialFetch'
import { useAdminContentApi } from '../app/composables/useAdminResource'
import { useKeyedListOptions } from '../app/composables/useKeyedListOptions'
import { syncEditorialSessionCookie } from '../app/utils/editorialSession'

const id = '11111111-1111-4111-8111-111111111111'
let token: string | null
let sessionError: Error | null
let sessionThrows: boolean
let sessionReads: number
let passwordProbeFails: boolean
let passwordProbes: Array<{ bearer?: string, browser?: string }>
let passwordSession: boolean
let cookieFailure: boolean
let headers: Array<{ bearer?: string, browser?: string }>
let authClient: SupabaseClient

function authorize(event: unknown) {
  const request = (event as { web: { request: Request } }).web.request
  const bearer = request.headers.get('authorization') ?? undefined
  const browser = request.headers.get('x-pz-browser-auth') ?? undefined
  headers.push({ bearer, browser })
  const account = bearer?.slice('Bearer '.length) ?? (browser === '1' ? null : 'old.editor.token')
  if (account === 'new.google.token' && !passwordSession) return new Response(null, { status: 403 })
  if (!account && !passwordSession) return new Response(null, { status: 401 })
  return { ok: true, rows: [], total: 0, items: [] }
}

for (const [path, methods] of [
  ['/api/admin/content/source', ['GET', 'POST']],
  [`/api/admin/content/source/${id}`, ['GET', 'PATCH', 'DELETE']],
  [`/api/admin/content/source/${id}/references`, ['GET']],
  [`/api/admin/content/source/${id}/revisions`, ['GET']],
  [`/api/admin/content/source/${id}/restore`, ['POST']],
  ['/api/admin/content/story_type', ['GET']],
  ['/api/review/daily', ['GET']],
  ['/api/review/daily/2026-11-21', ['PUT', 'DELETE']]
] as const) {
  for (const method of methods) registerEndpoint(path, { method, handler: authorize })
}
registerEndpoint('/api/admin/session', {
  method: 'GET',
  handler: (event) => {
    const request = (event as unknown as { web: { request: Request } }).web.request
    passwordProbes.push({
      bearer: request.headers.get('authorization') ?? undefined,
      browser: request.headers.get('x-pz-browser-auth') ?? undefined
    })
    if (passwordProbeFails) return new Response(null, { status: 503 })
    return { authenticated: passwordSession }
  }
})
registerEndpoint('/api/admin/social-session', {
  method: 'POST',
  handler: () => {
    if (cookieFailure) return new Response(null, { status: 503 })
    return { ok: true }
  }
})

const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
beforeEach(() => {
  clearNuxtState(key => key === 'pz-supabase-client' || key.startsWith('admin-options-'))
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name: string, action: () => Promise<void>) => action() } })
  token = 'new.google.token'
  sessionError = null
  sessionThrows = false
  sessionReads = 0
  passwordProbeFails = false
  passwordProbes = []
  passwordSession = false
  cookieFailure = true
  headers = []
  authClient = {
    auth: { getSession: async () => {
      sessionReads++
      if (sessionThrows) throw new Error('refresh endpoint unavailable')
      return { data: { session: token ? { access_token: token } : null }, error: sessionError }
    } }
  } as unknown as SupabaseClient
  useState('pz-supabase-client').value = authClient
})
afterEach(() => {
  clearNuxtState(key => key === 'pz-supabase-client' || key.startsWith('admin-options-'))
  if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks)
  else Reflect.deleteProperty(navigator, 'locks')
})

describe('protected browser credentials', () => {
  it('omits the role-none Google Bearer when the server confirms password access', async () => {
    passwordSession = true
    await expect(useAdminContentApi('source').update(id, { revision: 1, label: 'changed record' })).resolves.toMatchObject({ ok: true })
    expect(headers).toEqual([{ bearer: undefined, browser: '1' }])
    expect(passwordProbes).toEqual([{ bearer: undefined, browser: '1' }])
    expect(sessionReads).toBe(0)
  })

  it.each(['get', 'create', 'update', 'archive', 'remove', 'references', 'revisions', 'restore'] as const)('refuses %s as role-none B after its cookie replacement fails', async (operation) => {
    await expect(syncEditorialSessionCookie(authClient)).rejects.toBeDefined()
    const api = useAdminContentApi('source')
    const calls = {
      get: () => api.get(id),
      create: () => api.create({ label: 'new record' }),
      update: () => api.update(id, { revision: 1, label: 'changed record' }),
      archive: () => api.archive(id),
      remove: () => api.remove(id),
      references: () => api.references(id),
      revisions: () => api.revisions(id),
      restore: () => api.restore(id, { revisionId: 1 })
    }
    await expect(calls[operation]()).rejects.toMatchObject({ statusCode: 403 })
    expect(headers).toEqual([{ bearer: 'Bearer new.google.token', browser: '1' }])
  })

  it.each(['GET', 'PUT', 'DELETE'] as const)('applies the same credential boundary to direct review %s requests', async (method) => {
    const request = useEditorialFetch()
    const path = method === 'GET' ? '/api/review/daily' : '/api/review/daily/2026-11-21'
    await expect(request(path, { method })).rejects.toMatchObject({ statusCode: 403 })
    expect(headers).toEqual([{ bearer: 'Bearer new.google.token', browser: '1' }])
  })

  it('keeps useFetch lists behind the same boundary', async () => {
    const Probe = defineComponent({
      setup: () => ({ items: useKeyedListOptions('story_type') }),
      render: () => null
    })
    const probe = await mountSuspended(Probe)
    await expect.poll(() => headers.length).toBe(1)
    expect(headers).toEqual([{ bearer: 'Bearer new.google.token', browser: '1' }])
    expect(probe.vm.items).toEqual([])
    probe.unmount()
  })

  it('refuses the stale editor cookie after the current browser account signs out', async () => {
    token = null
    await expect(useEditorialFetch()('/api/review/daily')).rejects.toMatchObject({ statusCode: 401 })
    expect(headers).toEqual([{ bearer: undefined, browser: '1' }])
  })

  it.each([true, false])('retains password authentication with a configured provider: %s', async (configured) => {
    token = null
    passwordSession = true
    if (!configured) useState('pz-supabase-client').value = null
    await expect(useEditorialFetch()('/api/review/daily')).resolves.toMatchObject({ ok: true })
    expect(headers).toEqual([{ bearer: undefined, browser: '1' }])
  })

  it('reads persisted credentials for each action and replaces an obsolete explicit Bearer', async () => {
    token = 'old.editor.token'
    const request = useEditorialFetch()
    await expect(request('/api/review/daily')).resolves.toMatchObject({ ok: true })
    token = 'new.google.token'
    await expect(request('/api/review/daily', { headers: { Authorization: 'Bearer old.editor.token' } })).rejects.toMatchObject({ statusCode: 403 })
    expect(headers.map(value => value.bearer)).toEqual(['Bearer old.editor.token', 'Bearer new.google.token'])
  })

  it.each([
    { failure: 'returned error', password: true },
    { failure: 'returned error', password: false },
    { failure: 'thrown error', password: true },
    { failure: 'thrown error', password: false }
  ])('keeps password precedence with Google $failure and password access $password', async ({ failure, password }) => {
    passwordSession = password
    token = 'expired.google.token'
    if (failure === 'returned error') sessionError = new Error('refresh endpoint unavailable')
    else sessionThrows = true
    const response = useEditorialFetch()('/api/review/daily', { headers: { Authorization: 'Bearer obsolete.google.token' } })
    if (password) await expect(response).resolves.toMatchObject({ ok: true })
    else await expect(response).rejects.toMatchObject({ statusCode: 401 })
    expect(headers).toEqual([{ bearer: undefined, browser: '1' }])
    expect(passwordProbes).toEqual([{ bearer: undefined, browser: '1' }])
    expect(sessionReads).toBe(password ? 0 : 1)
  })

  it.each([true, false])('leaves authorization to the server when the password probe fails, password access %s', async (password) => {
    passwordSession = password
    passwordProbeFails = true
    const response = useEditorialFetch()('/api/review/daily')
    if (password) await expect(response).resolves.toMatchObject({ ok: true })
    else await expect(response).rejects.toMatchObject({ statusCode: 401 })
    expect(headers).toEqual([{ bearer: undefined, browser: '1' }])
    expect(passwordProbes).toEqual([{ bearer: undefined, browser: '1' }])
    expect(sessionReads).toBe(0)
  })
})
