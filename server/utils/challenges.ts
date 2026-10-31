import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import type { ChallengeContent, ChallengeState, QuizChallengeInput } from '../../shared/utils/challenge'
import { challengeNickname } from '../../shared/utils/challenge'
import { currentChallengeContent, quizChallengeContent } from './challengeContent'

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
  const origin = getRequestHeader(event, 'origin')
  if (origin) {
    let host: string
    try {
      host = new URL(origin).host
    } catch {
      throw createError({ statusCode: 403, statusMessage: 'Invalid origin' })
    }
    if (host !== getRequestHeader(event, 'host')) throw createError({ statusCode: 403, statusMessage: 'Invalid origin' })
  }
  const length = getRequestHeader(event, 'content-length') ?? ''
  if (!/^\d+$/.test(length)) throw createError({ statusCode: 411, statusMessage: 'Content-Length required' })
  if (Number(length) > BODY_LIMIT) throw createError({ statusCode: 413, statusMessage: 'Request too large' })
  if (!getRequestHeader(event, 'content-type')?.startsWith('application/json')) throw createError({ statusCode: 415, statusMessage: 'JSON required' })
  const body = await readBody(event).catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > BODY_LIMIT) throw createError({ statusCode: 400, statusMessage: 'Invalid request' })
  return body as Record<string, unknown>
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
  let content: ChallengeContent = currentChallengeContent
  let quiz: QuizChallengeInput | null = null
  if (create && body.quiz !== undefined) {
    quiz = body.quiz as QuizChallengeInput
    try {
      content = quizChallengeContent(quiz, (await publicWords(100)).words)
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Invalid quiz challenge' })
    }
  }
  const code = create ? randomBytes(12).toString('base64url') : challengeCode(event)
  const existing = participantHash(event, code)
  const token = existing ? null : randomBytes(32).toString('base64url')
  const hash = existing ?? tokenHash(token!)
  let state = await challengeRpc(create ? 'create' : 'join', code, hash, {
    nickname, ...(create ? { content } : {})
  })
  if (quiz) state = await completeQuizChallenge(code, hash, content, quiz.results)
  if (token) setCookie(event, `heritage_${code}`, token, {
    httpOnly: true, secure: !import.meta.dev && getRequestURL(event).protocol === 'https:',
    sameSite: 'lax', path: `/api/challenges/${code}`, maxAge: 365 * 86400
  })
  setResponseStatus(event, create ? 201 : 200)
  return state
}

async function completeQuizChallenge(code: string, hash: string, content: ChallengeContent, results: boolean[]) {
  let completed: ChallengeState | undefined
  const questions = content.rounds.flatMap(round => round.questions)
  for (const [index, question] of questions.entries()) {
    await challengeRpc('reveal', code, hash)
    let state = await challengeRpc('answer', code, hash, {
      questionId: question.id,
      selected: results[index] ? question.correct : (question.correct + 1) % question.options.length
    })
    state = await challengeRpc('continue', code, hash, {
      phase: state.participant!.phase,
      index: state.participant!.index
    })
    if (state.participant?.phase === 'round') {
      state = await challengeRpc('continue', code, hash, {
        phase: state.participant.phase,
        index: state.participant.index
      })
    }
    completed = state
  }
  return completed!
}

export async function readChallenge(event: H3Event) {
  challengeLimit(event, 'action')
  const code = challengeCode(event)
  return challengeRpc('state', code, participantHash(event, code))
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
