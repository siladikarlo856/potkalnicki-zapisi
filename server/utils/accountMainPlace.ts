import type { H3Event } from 'h3'
import type { PlaceOption } from '../../shared/types/place'
import { requireVerifiedAccount } from './accountSync'
import { databaseError, useDatabaseClient } from './db'
import { resolveContributionPlace } from './places'

export type MainPlacePreference = {
  mainPlaceId: string | null
  place: PlaceOption | null
  /** Stored Naselje is archived or otherwise no longer a published preference. */
  archivedNote: string | null
}

export const MAIN_PLACE_REJECTED_MESSAGE
  = 'Samo objavljena naselja iz kataloga mogu biti glavno mjesto. Odaberi naselje iz popisa.'

export const MAIN_PLACE_ARCHIVED_NOTE
  = 'Spremljeno naselje više nije objavljeno, pa se ne koristi kao glavno mjesto.'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type AreaRow = {
  id: string
  name: string
  kind: string
  status: string
  parent_id: string | null
}

async function areaById(id: string): Promise<AreaRow | null> {
  const geonamesId = /^geonames:(\d{1,10})$/.exec(id)?.[1]
  if (!geonamesId && !UUID_PATTERN.test(id)) return null
  const { data, error } = await useDatabaseClient()
    .from('areas')
    .select('id,name,kind,status,parent_id')
    .eq(geonamesId ? 'geonames_id' : 'id', geonamesId ?? id)
    .maybeSingle()
  if (error) databaseError(error)
  return data as AreaRow | null
}

async function publishedSettlementPlace(id: string): Promise<PlaceOption | null> {
  const area = await areaById(id)
  if (!area || area.kind !== 'settlement' || area.status !== 'published') return null
  const catalog = resolveContributionPlace(id)
  if (catalog) {
    return { id: area.id, name: catalog.name, municipality: catalog.municipality, county: catalog.county }
  }
  let municipality = ''
  if (area.parent_id) {
    const parent = await areaById(area.parent_id)
    municipality = parent?.name ?? ''
  }
  return { id: area.id, name: area.name, municipality, county: '' }
}

async function ensureProfile(accountId: string) {
  const db = useDatabaseClient()
  const { data, error: readError } = await db.from('account_profiles').select('id').eq('id', accountId).maybeSingle()
  if (readError) databaseError(readError)
  if (data) return
  const { error } = await db.from('account_profiles').insert({ id: accountId })
  if (error) databaseError(error)
}

export async function loadAccountMainPlace(accountId: string): Promise<MainPlacePreference> {
  const { data, error } = await useDatabaseClient()
    .from('account_profiles')
    .select('main_place_id')
    .eq('id', accountId)
    .maybeSingle()
  if (error) databaseError(error)
  const storedId = (data?.main_place_id as string | null | undefined) ?? null
  if (!storedId) {
    return { mainPlaceId: null, place: null, archivedNote: null }
  }
  const place = await publishedSettlementPlace(storedId)
  if (place) {
    return { mainPlaceId: storedId, place, archivedNote: null }
  }
  return {
    mainPlaceId: null,
    place: null,
    archivedNote: MAIN_PLACE_ARCHIVED_NOTE
  }
}

export async function saveAccountMainPlace(accountId: string, mainPlaceId: string | null): Promise<MainPlacePreference> {
  if (mainPlaceId !== null) {
    const place = await publishedSettlementPlace(mainPlaceId)
    if (!place) {
      throw createError({ statusCode: 400, statusMessage: MAIN_PLACE_REJECTED_MESSAGE })
    }
    mainPlaceId = place.id
  }
  await ensureProfile(accountId)
  const { error } = await useDatabaseClient()
    .from('account_profiles')
    .update({ main_place_id: mainPlaceId })
    .eq('id', accountId)
  if (error) {
    if (/published Naselje/i.test(error.message)) {
      throw createError({ statusCode: 400, statusMessage: MAIN_PLACE_REJECTED_MESSAGE })
    }
    databaseError(error)
  }
  return loadAccountMainPlace(accountId)
}

export async function mainPlaceForVerifiedAccount(event: H3Event) {
  const { accountId } = await requireVerifiedAccount(event)
  return { accountId, preference: await loadAccountMainPlace(accountId) }
}

export async function updateMainPlaceForVerifiedAccount(event: H3Event, mainPlaceId: string | null) {
  const { accountId } = await requireVerifiedAccount(event)
  return { accountId, preference: await saveAccountMainPlace(accountId, mainPlaceId) }
}
