import type { ChallengeLeaderboard } from '../../../../shared/utils/challenge'

export default defineEventHandler(async (event) => {
  challengeLimit(event, 'action')
  const offset = Number(getQuery(event).offset ?? 0)
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) throw createError({ statusCode: 400, statusMessage: 'Invalid offset' })
  const { data, error } = await useDatabaseClient().rpc('heritage_challenge_scoreboard', { p_code: challengeCode(event), p_offset: offset })
  if (error?.code === 'PT404') throw createError({ statusCode: 404, statusMessage: 'Challenge not found' })
  if (error) databaseError(error)
  return data as ChallengeLeaderboard
})
