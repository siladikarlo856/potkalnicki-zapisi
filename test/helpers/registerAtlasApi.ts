import { createError, getQuery, getRouterParam } from 'h3'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { buildPublicContent } from '../../server/utils/publicContent'
import {
  atlasOverview,
  contentTarget,
  heritageItemDetail,
  heritageList,
  isContentTargetKind,
  municipalityPage,
  resolveHeritageItem,
  resolveMunicipality,
  resolveSettlement,
  settlementPage
} from '../../server/utils/publicAtlas'
import { fakeContentRows } from './fakeContentSeed'

let cached: ReturnType<typeof buildPublicContent> | undefined

function content() {
  cached ??= buildPublicContent(fakeContentRows(), {})
  return cached
}

function heritageItemResponse(settlement: string, slug: string) {
  const result = resolveHeritageItem(content(), settlement, slug)
  if (result.status === 'redirect') return { redirect: result.path }
  if (result.status === 'gone') throw createError({ statusCode: 410, statusMessage: 'Content has been removed' })
  if (result.status !== 'ok') throw createError({ statusCode: 404, statusMessage: 'Heritage item not found' })
  return { item: heritageItemDetail(content(), result.value) }
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
}
