import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import type { ChallengeContent, ChallengeMeta, ChallengeState, QuizChallengeInput } from '../../shared/utils/challenge'
import type { CardKey } from '../../shared/utils/learn/types'
import { validateChallengeContent } from '../../shared/utils/content/challengeTemplate'
import { challengeNickname } from '../../shared/utils/challenge'
import { quizChallengeContent, generatedChallengeContent, parseGenerateInput } from './challengeContent'
import { currentChallengeContent, challengeContentFromSet } from './challengeTemplates'
import { getCardPool } from './cardPool'
import { mulberry32 } from '../../shared/utils/games/rng'

const BODY_LIMIT = 8192

export function challengeCode(event: H3Event) {
  const code = getRouterParam(event, 'code') ?? ''
  if (!/^[A-Za-z0-9_-]{16,32}$/.test(code)) throw createError({ statusCode: 404, statusMessage: 'Challenge not found' })
  return code
}

export function challengeLimit(event: H3Event, kind: 'create' | 'join' | 'action') {
  const config = useRuntimeConfig(event).challengeRateLimit
  const key = clientKey(event)
  if (isRateLimited(`challenge-${kind}`, key, config[kind], config.windowSeconds)) throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  countRateLimit(`challenge-${kind}`, key, config.windowSeconds)
}

export async function challengeBody(event: H3Event) {
  assertSameOrigin(event)
  return readJsonObject(event, BODY_LIMIT)
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function participantHash(event: H3Event, code: string) {
  const token = getCookie(event, `heritage_${code}`)
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? tokenHash(token) : null
}

export async function challengeRpc<T = ChallengeState>(action: string, code: string, hash: string | null, input: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await useDatabaseClient().rpc('heritage_challenge_action', {
    p_action: action, p_code: code, p_hash: hash, p_input: input
  })
  if (error) {
    const status = /^PT(400|401|404|409|410)$/.exec(error.code)?.[1]
    if (status) throw createError({ statusCode: Number(status), statusMessage: error.message })
    databaseError(error)
  }
  return data as T
}

export async function enterChallenge(event: H3Event, create: boolean) {
  challengeLimit(event, create ? 'create' : 'join')
  const body = await challengeBody(event)
  const nickname = challengeNickname(body.nickname)
  if (!nickname) throw createError({ statusCode: 400, statusMessage: 'Invalid nickname' })
  // Only creation needs content: a join plays the snapshot stored with the challenge.
  let content: ChallengeContent | null = null
  let quiz: QuizChallengeInput | null = null
  if (create && body.generate !== undefined) {
    try {
      const pool = await getCardPool()
      content = generatedChallengeContent(parseGenerateInput(body.generate, pool), pool, mulberry32(randomBytes(4).readUInt32LE(0)))
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Invalid challenge settings' })
    }
  } else if (create && body.set !== undefined) {
    if (body.quiz !== undefined || typeof body.set !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Invalid challenge settings' })
    }
    try {
      content = await challengeContentFromSet(body.set)
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Invalid challenge settings' })
    }
  } else if (create && body.quiz !== undefined) {
    quiz = body.quiz as QuizChallengeInput
    try {
      content = quizChallengeContent(quiz, (await publicWords(100)).words)
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Invalid quiz challenge' })
    }
  } else if (create) {
    content = await currentChallengeContent()
  }
  const code = create ? randomBytes(12).toString('base64url') : challengeCode(event)
  const existing = participantHash(event, code)
  const token = existing ? null : randomBytes(32).toString('base64url')
  const hash = existing ?? tokenHash(token!)
  // A Quiz-result challenge is recorded already finished, with the creator's Quiz results, in one call.
  const action = quiz ? 'create_completed' : create ? 'create' : 'join'
  const state = await challengeRpc(action, code, hash, {
    nickname, ...(create ? { content } : {}), ...(quiz ? { results: quiz.results } : {})
  })
  if (token) setCookie(event, `heritage_${code}`, token, {
    httpOnly: true, secure: !import.meta.dev && getRequestURL(event).protocol === 'https:',
    sameSite: 'lax', path: `/api/challenges/${code}`, maxAge: 365 * 86400
  })
  setResponseStatus(event, create ? 201 : 200)
  return state
}

function challengeMetaFromContent(content: unknown): ChallengeMeta | null {
  if (typeof content !== 'object' || content === null || Array.isArray(content)) return null
  const meta = (content as { meta?: unknown }).meta
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return null
  const source = (meta as { source?: unknown }).source
  if (source !== 'random' && source !== 'set' && source !== 'quiz') return null
  return meta as ChallengeMeta
}

export function challengeQuestionCards(content: ChallengeContent): CardKey[] {
  const seen = new Set<CardKey>()
  const cards: CardKey[] = []
  for (const question of content.rounds.flatMap(round => round.questions)) {
    if (!question.card || seen.has(question.card)) continue
    seen.add(question.card)
    cards.push(question.card)
  }
  return cards
}

export async function readChallenge(event: H3Event) {
  challengeLimit(event, 'action')
  const code = challengeCode(event)
  const state = await challengeRpc('state', code, participantHash(event, code))
  let meta: ChallengeMeta | null = null
  try {
    const { data, error } = await useDatabaseClient().from('heritage_challenges').select('content').eq('code', code).maybeSingle()
    if (!error && data?.content) meta = challengeMetaFromContent(data.content)
  } catch {
    meta = null
  }
  return { ...state, meta } satisfies ChallengeState
}

export async function readChallengeQuestionCards(event: H3Event): Promise<{ cards: CardKey[] }> {
  challengeLimit(event, 'action')
  const code = challengeCode(event)
  const state = await challengeRpc('state', code, participantHash(event, code))
  if (state.participant?.phase !== 'finished') {
    throw createError({ statusCode: 409, statusMessage: 'Challenge not finished' })
  }
  const { data, error } = await useDatabaseClient().from('heritage_challenges').select('content').eq('code', code).maybeSingle()
  if (error) databaseError(error)
  if (!data?.content) throw createError({ statusCode: 404, statusMessage: 'Challenge not found' })
  return { cards: challengeQuestionCards(validateChallengeContent(data.content)) }
}

export async function changeChallenge(event: H3Event, action: 'reveal' | 'answer' | 'continue') {
  challengeLimit(event, 'action')
  const code = challengeCode(event)
  const body = await challengeBody(event)
  let input: Record<string, unknown> = {}
  if (action === 'answer') {
    if (typeof body.questionId !== 'string' || body.questionId.length > 200
      || !(body.selected === null || (Number.isInteger(body.selected) && Number(body.selected) >= 0 && Number(body.selected) <= 3))) throw createError({ statusCode: 400, statusMessage: 'Invalid answer' })
    input = { questionId: body.questionId, selected: body.selected }
  }
  if (action === 'continue') {
    if (!['feedback', 'round'].includes(String(body.phase)) || !Number.isInteger(body.index) || Number(body.index) < 0 || Number(body.index) > 200) throw createError({ statusCode: 400, statusMessage: 'Invalid progress' })
    input = { phase: body.phase, index: body.index }
  }
  return challengeRpc(action, code, participantHash(event, code), input)
}
