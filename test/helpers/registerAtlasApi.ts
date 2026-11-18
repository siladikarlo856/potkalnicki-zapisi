import { createError, getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { buildPublicContent } from '../../server/utils/publicContent'
import {
  atlasOverview,
  contentTarget,
  heritageItemDetail,
  heritageList,
  isContentTargetKind,
  municipalityPage,
  personDetail,
  personList,
  resolvePerson,
  resolveHeritageItem,
  resolveMunicipality,
  resolveSettlement,
  searchContent,
  settlementPage,
  suggestOptions
} from '../../server/utils/publicAtlas'
import {
  intangibleDetail,
  intangibleList,
  narratorPage,
  resolveIntangible,
  resolveNarrator,
  resolveTheme,
  themePage
} from '../../server/utils/publicIntangible'
import { fakeRowsWithIntangible } from './fakeIntangible'

let cached: ReturnType<typeof buildPublicContent> | undefined

function content() {
  cached ??= buildPublicContent(fakeRowsWithIntangible(), {})
  return cached
}

function resolvePersonValue(slug: string) {
  const result = resolvePerson(content(), slug)
  if (result.status !== 'ok') throw createError({ statusCode: 404, statusMessage: 'Person not found' })
  return result.value
}

function heritageItemResponse(settlement: string, slug: string) {
  const result = resolveHeritageItem(content(), settlement, slug)
  if (result.status === 'redirect') return { redirect: result.path }
  if (result.status === 'gone') throw createError({ statusCode: 410, statusMessage: 'Content has been removed' })
  if (result.status !== 'ok') throw createError({ statusCode: 404, statusMessage: 'Heritage item not found' })
  return { item: heritageItemDetail(content(), result.value) }
}

// registerEndpoint hands handlers a web-backed event, which h3's getQuery cannot read: take it from the request URL.
function getQuery(event: H3Event): Record<string, string> {
  const url = (event as unknown as { web?: { request: Request } }).web?.request.url ?? event.path
  return Object.fromEntries(new URL(url, 'http://localhost').searchParams)
}

function intangibleResponse(kind: string, slug: string) {
  const result = resolveIntangible(content(), kind, slug)
  if (result.status === 'redirect') return { redirect: result.path }
  if (result.status === 'gone') throw createError({ statusCode: 410, statusMessage: 'Content has been removed' })
  if (result.status !== 'ok') throw createError({ statusCode: 404, statusMessage: 'Record not found' })
  return { record: intangibleDetail(content(), result.value) }
}

function themeResponse(slug: string) {
  const result = resolveTheme(content(), slug)
  if (result.status === 'redirect') return { redirect: result.path }
  if (result.status !== 'ok') throw createError({ statusCode: result.status === 'gone' ? 410 : 404, statusMessage: 'Theme not found' })
  return themePage(content(), result.value)
}

function narratorResponse(slug: string) {
  const result = resolveNarrator(content(), slug)
  if (result.status === 'redirect') return { redirect: result.path }
  if (result.status !== 'ok') throw createError({ statusCode: result.status === 'gone' ? 410 : 404, statusMessage: 'Narrator not found' })
  return narratorPage(content(), result.value)
}

/** Mock public atlas API routes for component tests (same data as the fake Supabase seed). */
export function registerAtlasApiEndpoints() {
  registerEndpoint('/api/atlas/overview', () => {
    const overview = atlasOverview(content())
    if (!overview) throw createError({ statusCode: 404, statusMessage: 'Atlas region not found' })
    return overview
  })
  registerEndpoint('/api/atlas/municipalities/:slug', (event) => {
    const slug = getRouterParam(event, 'slug') ?? ''
    const result = resolveMunicipality(content(), slug)
    if (result.status === 'redirect') return { redirect: result.path }
    if (result.status !== 'ok') throw createError({ statusCode: 404, statusMessage: 'Municipality not found' })
    return municipalityPage(content(), result.value)
  })
  registerEndpoint('/api/atlas/settlements/:slug', (event) => {
    const slug = getRouterParam(event, 'slug') ?? ''
    const result = resolveSettlement(content(), slug)
    if (result.status === 'redirect') return { redirect: result.path }
    if (result.status !== 'ok') throw createError({ statusCode: 404, statusMessage: 'Settlement not found' })
    return settlementPage(content(), result.value)
  })
  registerEndpoint('/api/atlas/heritage', (event) => {
    const query = getQuery(event)
    const filter = {
      municipality: typeof query.municipality === 'string' ? query.municipality : undefined,
      category: typeof query.category === 'string' ? query.category : undefined
    }
    const list = heritageList(content(), filter)
    if (!list) throw createError({ statusCode: 400, statusMessage: 'Unknown municipality or category' })
    return list
  })
  registerEndpoint('/api/atlas/heritage/:settlement/:slug', (event) => {
    return heritageItemResponse(getRouterParam(event, 'settlement') ?? '', getRouterParam(event, 'slug') ?? '')
  })
  registerEndpoint('/api/atlas/heritage/kalnik/crkva-sv-brcka', () => heritageItemResponse('kalnik', 'crkva-sv-brcka'))
  registerEndpoint('/api/atlas/municipalities/opcina-kalnik', () => {
    const result = resolveMunicipality(content(), 'opcina-kalnik')
    if (result.status !== 'ok') throw createError({ statusCode: 404, statusMessage: 'Municipality not found' })
    return municipalityPage(content(), result.value)
  })
  registerEndpoint('/api/atlas/settlements/kalnik', () => {
    const result = resolveSettlement(content(), 'kalnik')
    if (result.status !== 'ok') throw createError({ statusCode: 404, statusMessage: 'Settlement not found' })
    return settlementPage(content(), result.value)
  })
  registerEndpoint('/api/atlas/persons', (event) => {
    const list = personList(content(), { municipality: getQuery(event).opcina })
    if (!list) throw createError({ statusCode: 400, statusMessage: 'Unknown municipality' })
    return list
  })
  registerEndpoint('/api/atlas/persons/:slug', (event) => {
    const result = resolvePerson(content(), getRouterParam(event, 'slug') ?? '')
    if (result.status === 'redirect') return { redirect: result.path }
    if (result.status === 'gone') throw createError({ statusCode: 410, statusMessage: 'Content has been removed' })
    if (result.status !== 'ok') throw createError({ statusCode: 404, statusMessage: 'Person not found' })
    return { person: personDetail(content(), result.value) }
  })
  // registerEndpoint hands handlers no router params, so the slugs the tests open are registered by name too.
  registerEndpoint('/api/atlas/persons/ivan-kalnican', () => ({ person: personDetail(content(), resolvePersonValue('ivan-kalnican')) }))
  registerEndpoint('/api/atlas/municipalities/opcina-gornja-rijeka', () => {
    const result = resolveMunicipality(content(), 'opcina-gornja-rijeka')
    if (result.status !== 'ok') throw createError({ statusCode: 404, statusMessage: 'Municipality not found' })
    return municipalityPage(content(), result.value)
  })
  registerEndpoint('/api/atlas/intangible', (event) => {
    const query = getQuery(event)
    const list = intangibleList(content(), { kind: query.kind, type: query.type, theme: query.theme, place: query.place })
    if (!list) throw createError({ statusCode: 400, statusMessage: 'Unknown filter' })
    return list
  })
  registerEndpoint('/api/atlas/intangible/price/kalnicka-vjestica', () => intangibleResponse('price', 'kalnicka-vjestica'))
  registerEndpoint('/api/atlas/intangible/obicaji/martinje-u-kalniku', () => intangibleResponse('obicaji', 'martinje-u-kalniku'))
  registerEndpoint('/api/atlas/intangible/narodni-tekstovi/martinjska-zdravica', () => intangibleResponse('narodni-tekstovi', 'martinjska-zdravica'))
  registerEndpoint('/api/atlas/themes/vino', () => themeResponse('vino'))
  registerEndpoint('/api/atlas/themes/prazna', () => themeResponse('prazna'))
  registerEndpoint('/api/atlas/narrators/marija-horvat', () => narratorResponse('marija-horvat'))
  registerEndpoint('/api/atlas/narrators/kazivac-r-1950-kalnik', () => narratorResponse('kazivac-r-1950-kalnik'))
  registerEndpoint('/api/content/target', (event) => {
    const query = getQuery(event)
    const kindRaw = typeof query.kind === 'string' ? query.kind : 'heritage_item'
    const id = typeof query.id === 'string' ? query.id : ''
    if (!isContentTargetKind(kindRaw)) throw createError({ statusCode: 400, statusMessage: 'Invalid kind' })
    const result = contentTarget(content(), kindRaw, id)
    if (result.status === 'gone') throw createError({ statusCode: 410, statusMessage: 'Content has been removed' })
    if (result.status === 'redirect') return { redirect: result.path }
    if (result.status !== 'ok') throw createError({ statusCode: 404, statusMessage: 'Content not found' })
    return result.value
  })
  registerEndpoint('/api/content/suggest-options', () => suggestOptions(content()))
  registerEndpoint('/api/content/search', (event) => {
    const q = getQuery(event).q
    return searchContent(content(), typeof q === 'string' ? q : '')
  })
  registerEndpoint('/api/submission-token', () => ({ token: 'test-token' }))
}
