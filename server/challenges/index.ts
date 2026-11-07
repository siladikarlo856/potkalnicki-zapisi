import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import type {
  ChallengeContent, ChallengeLeaderboard, ChallengeMeta, ChallengeSetPublic, ChallengeState, QuizChallengeInput
} from '../../shared/utils/challenge'
import type { CardKey } from '../../shared/utils/learn/types'
import { challengeNickname } from '../../shared/utils/challenge'
import { mulberry32 } from '../../shared/utils/games/rng'
import { getCardPool } from '../utils/cardPool'
import {
  challengeOverview, challengeQuestionCards, generatedChallengeContent, parseGenerateInput, quizChallengeContent,
  validateChallengeContent
} from './content'
import type { ChallengeAction } from './database'
import { challengeAction, challengeScoreboard, storedChallengeContent } from './database'
import { challengeContentFromSet, currentChallengeContent, publishedChallengeSets } from './templates'

// The Challenge module. The challenge API routes (server/api/challenges) call only this interface;
// behind it, database.ts is the one adapter to the challenge RPC and tables, and
// content.ts is the one home of the content shape. A Participant is known by an httpOnly cookie
// holding a random token; the database only ever sees its hash.

const BODY_LIMIT = 8192

function challengeCode(event: H3Event) {
  const code = getRouterParam(event, 'code') ?? ''
  if (!/^[A-Za-z0-9_-]{16,32}$/.test(code)) throw createError({ statusCode: 404, statusMessage: 'Challenge not found' })
  return code
}

function challengeLimit(event: H3Event, kind: 'create' | 'join' | 'action') {
  const config = useRuntimeConfig(event).challengeRateLimit
  const key = clientKey(event)
  if (isRateLimited(`challenge-${kind}`, key, config[kind], config.windowSeconds)) throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  countRateLimit(`challenge-${kind}`, key, config.windowSeconds)
}

async function challengeBody(event: H3Event) {
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

function invalid(statusMessage: string): never {
  throw createError({ statusCode: 400, statusMessage })
}

/** The content of a new challenge from the create form: generated, a picked set, a Quiz, or the current template. */
async function newChallengeContent(body: Record<string, unknown>): Promise<{ content: ChallengeContent, quiz: QuizChallengeInput | null }> {
  if (body.generate !== undefined) {
    try {
      const pool = await getCardPool()
      return { content: generatedChallengeContent(parseGenerateInput(body.generate, pool), pool, mulberry32(randomBytes(4).readUInt32LE(0))), quiz: null }
    } catch {
      invalid('Invalid challenge settings')
    }
  }
  if (body.set !== undefined) {
    if (body.quiz !== undefined || typeof body.set !== 'string') invalid('Invalid challenge settings')
    try {
      return { content: await challengeContentFromSet(body.set), quiz: null }
    } catch {
      invalid('Invalid challenge settings')
    }
  }
  if (body.quiz !== undefined) {
    const quiz = body.quiz as QuizChallengeInput
    try {
      return { content: quizChallengeContent(quiz, (await publicWords(100)).words), quiz }
    } catch {
      invalid('Invalid quiz challenge')
    }
  }
  return { content: await currentChallengeContent(), quiz: null }
}

/**
 * Creates a Challenge with its creator as the first Participant. A Quiz-result challenge is recorded
 * already finished, with the creator's Quiz results, in one call (`create_completed`).
 */
export async function createChallenge(event: H3Event): Promise<ChallengeState> {
  challengeLimit(event, 'create')
  const body = await challengeBody(event)
  const nickname = challengeNickname(body.nickname)
  if (!nickname) invalid('Invalid nickname')
  const { content, quiz } = await newChallengeContent(body)
  return enterAs(event, null, quiz
    ? { action: 'create_completed', input: { nickname, content, results: quiz.results } }
    : { action: 'create', input: { nickname, content } })
}

/** Joins a Participant under a nickname; they play the snapshot stored with the challenge. */
export async function joinChallenge(event: H3Event): Promise<ChallengeState> {
  challengeLimit(event, 'join')
  const code = challengeCode(event)
  const body = await challengeBody(event)
  const nickname = challengeNickname(body.nickname)
  if (!nickname) invalid('Invalid nickname')
  return enterAs(event, code, { action: 'join', input: { nickname } })
}

/** Records the requester as a Participant, issuing their cookie on first entry. */
async function enterAs(event: H3Event, code: string | null, call: { action: ChallengeAction, input: Record<string, unknown> }) {
  const challenge = code ?? randomBytes(12).toString('base64url')
  const existing = participantHash(event, challenge)
  const token = existing ? null : randomBytes(32).toString('base64url')
  const state = await challengeAction(call.action, challenge, existing ?? tokenHash(token!), call.input)
  if (token) setCookie(event, `heritage_${challenge}`, token, {
    httpOnly: true, secure: !import.meta.dev && getRequestURL(event).protocol === 'https:',
    sameSite: 'lax', path: `/api/challenges/${challenge}`, maxAge: 365 * 86400
  })
  setResponseStatus(event, code ? 200 : 201)
  return state
}

async function play(event: H3Event, action: 'reveal' | 'answer' | 'continue', input: (body: Record<string, unknown>) => Record<string, unknown>) {
  challengeLimit(event, 'action')
  const code = challengeCode(event)
  const body = await challengeBody(event)
  return challengeAction(action, code, participantHash(event, code), input(body))
}

/** Shows the Participant the next question. */
export function revealChallengeQuestion(event: H3Event): Promise<ChallengeState> {
  return play(event, 'reveal', () => ({}))
}

/** Answers the current question: `selected` is an option index, or null when time ran out. */
export function answerChallenge(event: H3Event): Promise<ChallengeState> {
  return play(event, 'answer', (body) => {
    if (typeof body.questionId !== 'string' || body.questionId.length > 200
      || !(body.selected === null || (Number.isInteger(body.selected) && Number(body.selected) >= 0 && Number(body.selected) <= 3))) invalid('Invalid answer')
    return { questionId: body.questionId, selected: body.selected }
  })
}

/** Moves the Participant past the feedback or round summary they have seen. */
export function continueChallenge(event: H3Event): Promise<ChallengeState> {
  return play(event, 'continue', (body) => {
    if (!['feedback', 'round'].includes(String(body.phase)) || !Number.isInteger(body.index) || Number(body.index) < 0 || Number(body.index) > 200) invalid('Invalid progress')
    return { phase: body.phase, index: body.index }
  })
}

/** The challenge as the requesting Participant (or a visitor) sees it, with the snapshot's meta. */
export async function readChallenge(event: H3Event): Promise<ChallengeState> {
  challengeLimit(event, 'action')
  const code = challengeCode(event)
  const state = await challengeAction('state', code, participantHash(event, code))
  let meta: ChallengeMeta | null
  try {
    meta = validateChallengeContent(await storedChallengeContent(code)).meta ?? null
  } catch {
    // The meta only labels the challenge; an unreadable snapshot must not hide the state.
    meta = null
  }
  return { ...state, meta }
}

/** The cards behind the questions, for a Participant who has finished. */
export async function readChallengeCards(event: H3Event): Promise<{ cards: CardKey[] }> {
  challengeLimit(event, 'action')
  const code = challengeCode(event)
  const state = await challengeAction('state', code, participantHash(event, code))
  if (state.participant?.phase !== 'finished') throw createError({ statusCode: 409, statusMessage: 'Challenge not finished' })
  const content = await storedChallengeContent(code)
  if (!content) throw createError({ statusCode: 404, statusMessage: 'Challenge not found' })
  return { cards: challengeQuestionCards(validateChallengeContent(content)) }
}

export async function readChallengeLeaderboard(event: H3Event): Promise<ChallengeLeaderboard> {
  challengeLimit(event, 'action')
  const offset = Number(getQuery(event).offset ?? 0)
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) invalid('Invalid offset')
  return challengeScoreboard(challengeCode(event), offset)
}

/** The introduction of a new Fixed challenge, from the current Challenge template: no questions or answers. */
export async function readChallengeIntroduction() {
  return challengeOverview(await currentChallengeContent())
}

/** The published Challenge templates for the set picker, without question bodies or answers. */
export function listChallengeSets(): Promise<ChallengeSetPublic[]> {
  return publishedChallengeSets()
}
