import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { searchContributionPlaces } from '../server/utils/places'

const h3: typeof import('h3') = createRequire(createRequire(import.meta.url).resolve('nuxt/package.json'))('@nuxt/nitro-server/h3')

const { requireVerifiedAccount } = vi.hoisted(() => ({
  requireVerifiedAccount: vi.fn()
}))

const { from, rpc } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn()
}))

vi.mock('../server/utils/accountSync', () => ({ requireVerifiedAccount }))
vi.mock('../server/utils/db', () => ({
  useDatabaseClient: () => ({ from, rpc }),
  databaseError: (error: { message: string }) => {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }
}))

const publishedSettlement = 'c9731a87-1dee-807a-94ed-83d47b96fad2'
const accountA = '00000000-0000-4000-8000-000000000001'
const accountB = '00000000-0000-4000-8000-000000000002'

function chain(result: unknown) {
  const terminal = vi.fn().mockResolvedValue(result)
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: terminal,
    single: terminal,
    insert: terminal,
    update: () => ({ eq: terminal })
  }
  return { query, terminal }
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  requireVerifiedAccount.mockResolvedValue({ accountId: accountA })
  for (const name of ['defineEventHandler', 'getRequestHeader', 'readBody', 'createError'] as const) {
    vi.stubGlobal(name, h3[name])
  }
})

afterEach(() => vi.unstubAllGlobals())

describe('account main place API', () => {
  it('loads the preference for the verified session account only', async () => {
    const profile = chain({ data: { main_place_id: publishedSettlement }, error: null })
    const areaPublished = chain({
      data: { id: publishedSettlement, name: 'Apatovec', kind: 'settlement', status: 'published', parent_id: 'town' },
      error: null
    })
    from.mockImplementation((table: string) => {
      if (table === 'account_profiles') return profile.query
      if (table === 'areas') return areaPublished.query
      throw new Error(`unexpected table ${table}`)
    })

    const getHandler = (await import('../server/api/account/main-place.get')).default
    const app = h3.createApp({ onError: (error, event) => h3.sendError(event, error) })
    app.use(getHandler)
    const response = await h3.toWebHandler(app)(new Request('https://example.com/api/account/main-place', {
      headers: { authorization: 'Bearer token' }
    }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.mainPlaceId).toBe(publishedSettlement)
    expect(body.place?.name).toBe('Apatovec')
    expect(requireVerifiedAccount).toHaveBeenCalledOnce()
    expect(profile.terminal).toHaveBeenCalled()
  })

  it('saves, changes and clears picker selections through PUT', async () => {
    let mainPlace: string | null = null
    let profileExists = false
    from.mockImplementation((table: string) => {
      if (table !== 'account_profiles') throw new Error(table)
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({
          data: profileExists ? { id: accountA, main_place_id: mainPlace } : null,
          error: null
        })),
        insert: vi.fn().mockImplementation(() => {
          profileExists = true
          return Promise.resolve({ error: null })
        }),
        update: vi.fn().mockImplementation(({ main_place_id }: { main_place_id: string | null }) => {
          mainPlace = main_place_id
          return { eq: () => Promise.resolve({ error: null }) }
        })
      }
      return query
    })

    const settlements = [
      { id: publishedSettlement, name: 'Apatovec', geonames_id: '3204790', kind: 'settlement', status: 'published', parent_id: null },
      { id: 'd01977de-5d29-8b74-b649-98636e6d73ed', name: 'Vojakovac', geonames_id: '3187460', kind: 'settlement', status: 'published', parent_id: null }
    ]
    function areaQuery() {
      const filters: [string, string][] = []
      const query = {
        select: () => query,
        eq: (field: string, value: string) => {
          filters.push([field, value])
          return query
        },
        maybeSingle: async () => {
          const invalidId = filters.find(([field, value]) => field === 'id' && !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value))
          if (invalidId) return { data: null, error: { message: `invalid input syntax for type uuid: "${invalidId[1]}"` } }
          const data = settlements.find(row => filters.every(([field, value]) => row[field as keyof typeof row] === value)) ?? null
          return { data, error: null }
        }
      }
      return query
    }
    const originalFrom = from.getMockImplementation()
    from.mockImplementation((table: string) => {
      if (table === 'areas') return areaQuery()
      return originalFrom!(table)
    })

    const putHandler = (await import('../server/api/account/main-place.put')).default
    const app = h3.createApp({ onError: (error, event) => h3.sendError(event, error) })
    app.use(putHandler)
    const request = (body: unknown) => h3.toWebHandler(app)(new Request('https://example.com/api/account/main-place', {
      method: 'PUT',
      headers: { 'authorization': 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }))

    expect((await request({ mainPlaceId: publishedSettlement })).status).toBe(200)
    expect(mainPlace).toBe(publishedSettlement)
    for (const settlement of settlements) {
      const choice = searchContributionPlaces(settlement.name).find(place => place.name === settlement.name)
      expect(choice).toBeDefined()
      const response = await request({ mainPlaceId: choice!.id })
      expect(response.status).toBe(200)
      expect(mainPlace).toBe(settlement.id)
      expect(await response.json()).toMatchObject({
        mainPlaceId: settlement.id,
        place: { id: settlement.id, name: settlement.name },
        archivedNote: null
      })
    }
    expect((await request({ mainPlaceId: null })).status).toBe(200)
    expect(mainPlace).toBeNull()
  })

  it.each([
    null,
    { kind: 'settlement', status: 'draft' },
    { kind: 'settlement', status: 'archived' },
    { kind: 'municipality', status: 'published' }
  ])('refuses unavailable picker places with a Croatian message: %j', async (area) => {
    const profile = chain({ data: { id: accountA }, error: null })
    const unavailableArea = chain({ data: area ? { id: publishedSettlement, name: 'Apatovec', parent_id: null, ...area } : null, error: null })
    from.mockImplementation((table: string) => {
      if (table === 'account_profiles') return profile.query
      if (table === 'areas') return unavailableArea.query
      throw new Error(table)
    })
    const { saveAccountMainPlace, MAIN_PLACE_REJECTED_MESSAGE } = await import('../server/utils/accountMainPlace')
    const choice = searchContributionPlaces('Apatovec').find(place => place.name === 'Apatovec')!
    await expect(saveAccountMainPlace(accountA, choice.id)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining(MAIN_PLACE_REJECTED_MESSAGE)
    })
    expect(profile.terminal).not.toHaveBeenCalled()
  })

  it('treats archived stored places as no preference with a note', async () => {
    const archived = '00000000-0000-4000-8000-000000000099'
    let reads = 0
    from.mockImplementation((table: string) => {
      if (table === 'account_profiles') {
        return chain({ data: { main_place_id: archived }, error: null }).query
      }
      if (table === 'areas') {
        reads++
        const status = reads === 1 ? 'archived' : 'published'
        return chain({
          data: { id: archived, name: 'Staro', kind: 'settlement', status, parent_id: 'town' },
          error: null
        }).query
      }
      throw new Error(table)
    })
    const { loadAccountMainPlace, MAIN_PLACE_ARCHIVED_NOTE } = await import('../server/utils/accountMainPlace')
    const preference = await loadAccountMainPlace(accountA)
    expect(preference.place).toBeNull()
    expect(preference.mainPlaceId).toBeNull()
    expect(preference.archivedNote).toBe(MAIN_PLACE_ARCHIVED_NOTE)
  })

  it('refuses a client-supplied account id in the body', async () => {
    const putHandler = (await import('../server/api/account/main-place.put')).default
    const app = h3.createApp({ onError: (error, event) => h3.sendError(event, error) })
    app.use(putHandler)
    const response = await h3.toWebHandler(app)(new Request('https://example.com/api/account/main-place', {
      method: 'PUT',
      headers: { 'authorization': 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ mainPlaceId: publishedSettlement, accountId: accountB })
    }))
    expect(response.status).toBe(400)
    expect(requireVerifiedAccount).not.toHaveBeenCalled()
  })
})
