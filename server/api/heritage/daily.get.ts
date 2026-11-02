import { isError } from 'h3'
import { DailyWordError, dailyCacheControl, resolveDailyWord } from '../../utils/dailyWord'

export default defineEventHandler(async (event) => {
  const now = new Date()
  const epoch = useRuntimeConfig().dailyWordEpoch
  try {
    const payload = await resolveDailyWord(useDatabaseClient(), now, epoch ? { epoch } : {})
    setResponseHeader(event, 'cache-control', dailyCacheControl(payload.nextAt, now))
    return payload
  } catch (error) {
    if (error instanceof DailyWordError) throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    if (isError(error)) throw error
    databaseError(error as Error)
  }
})
