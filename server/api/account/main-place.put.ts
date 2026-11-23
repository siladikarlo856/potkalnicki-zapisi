import { updateMainPlaceForVerifiedAccount } from '~~/server/utils/accountMainPlace'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ mainPlaceId?: unknown, accountId?: unknown }>(event).catch(() => null)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Neispravan zahtjev.' })
  }
  if ('accountId' in body && body.accountId !== undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Neispravan zahtjev.' })
  }
  const { mainPlaceId } = body
  if (mainPlaceId !== null && mainPlaceId !== undefined && typeof mainPlaceId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Neispravan zahtjev.' })
  }
  const { preference } = await updateMainPlaceForVerifiedAccount(event, (mainPlaceId as string | null | undefined) ?? null)
  return preference
})
