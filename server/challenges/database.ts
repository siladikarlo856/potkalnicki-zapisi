import type { ChallengeLeaderboard, ChallengeState } from '../../shared/utils/challenge'

// The Challenge module's one adapter to Postgres: every call to heritage_challenge_action and
// heritage_challenge_scoreboard, and every read of heritage_challenges and of the Challenge templates
// a challenge is created from, goes through here. Rows come back raw; content.ts parses them.

export type ChallengeAction = 'create' | 'create_completed' | 'join' | 'state' | 'reveal' | 'answer' | 'continue'

/** The `PT4xx` refusals the challenge functions raise, as HTTP errors; anything else is a database error. */
function refusal(error: { code: string, message: string }): never {
  const status = /^PT(400|401|404|409|410)$/.exec(error.code)?.[1]
  if (status) throw createError({ statusCode: Number(status), statusMessage: error.message })
  databaseError(error)
}

export async function challengeAction(action: ChallengeAction, code: string, hash: string | null, input: Record<string, unknown> = {}): Promise<ChallengeState> {
  const { data, error } = await useDatabaseClient().rpc('heritage_challenge_action', {
    p_action: action, p_code: code, p_hash: hash, p_input: input
  })
  if (error) refusal(error)
  return data as ChallengeState
}

export async function challengeScoreboard(code: string, offset: number): Promise<ChallengeLeaderboard> {
  const { data, error } = await useDatabaseClient().rpc('heritage_challenge_scoreboard', { p_code: code, p_offset: offset })
  if (error) refusal(error)
  return data as ChallengeLeaderboard
}

/** The content snapshot a challenge stores, unparsed; null when there is no such challenge. */
export async function storedChallengeContent(code: string): Promise<unknown> {
  const { data, error } = await useDatabaseClient().from('heritage_challenges').select('content').eq('code', code).maybeSingle()
  if (error) databaseError(error)
  return data?.content ?? null
}

export interface TemplateRow { id: string, revision: number, content: unknown, status: string, is_current: boolean }

export async function currentTemplateRow(): Promise<TemplateRow | null> {
  const { data, error } = await useDatabaseClient().from('heritage_challenge_templates')
    .select('id, revision, content, status, is_current').eq('is_current', true).maybeSingle()
  if (error) databaseError(error)
  return data
}

export async function templateRow(id: string): Promise<TemplateRow | null> {
  const { data, error } = await useDatabaseClient().from('heritage_challenge_templates')
    .select('id, revision, content, status, is_current').eq('id', id).maybeSingle()
  if (error) databaseError(error)
  return data
}

export async function publishedTemplateRows(): Promise<Pick<TemplateRow, 'id' | 'content'>[]> {
  const { data, error } = await useDatabaseClient().from('heritage_challenge_templates')
    .select('id, content, is_current')
    .eq('status', 'published')
    .order('is_current', { ascending: false })
    .order('name', { ascending: true })
  if (error) databaseError(error)
  return data ?? []
}
