import type { ChallengeContent, ChallengeMeta, ChallengeQuestion, ChallengeText } from '../challenge'
import type { ContentEntity, ContentIssue, ContentStatus, ContentValidation } from './common'
import { contentStatus, isRecord, isUuid, issueCollector } from './common'
import { CARD_KEY, type CardKey, type TopicId } from '../learn/types'
import { CHALLENGEABLE_GAMES, type Difficulty, type QuestionDisplay } from '../games/types'
import { MAP_FRAME } from '../games/mapFrame'

// Challenge templates (Izazovi): the fixed challenge sets an admin edits. The current template is
// copied into every new fixed challenge as an immutable snapshot (`heritage_challenges.content`).
// One set of rules serves the admin dialog, the admin API and every snapshot (fixed or built from a
// played quiz), so a template that saves is always one a challenge can be created from.

export const CHALLENGE_LIMITS = {
  name: 200,
  /** Each Croatian or English text: title, topic, prompt, option or explanation. */
  text: 2000,
  /** Round and question ids: stable, used by answers (`questionId`). */
  id: 200,
  rounds: 10,
  questionsPerRound: 20,
  minOptions: 2,
  maxOptions: 4,
  /**
   * UTF-8 bytes of the content as JSON. The database caps `content::text` at 256 KiB, and jsonb's text
   * form adds a space after every colon and comma, so this keeps headroom below that cap.
   */
  contentBytes: 248 * 1024,
  /** Admin request body cap for this kind. */
  bodyBytes: 256 * 1024
} as const

export const CHALLENGE_MECHANIC = 'multiple-choice'
const CHALLENGE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/
const TOPIC_ID = /^[a-z0-9-]{1,40}$/
const DIFFICULTIES = new Set<Difficulty>(['lako', 'srednje', 'tesko'])
const LANGUAGES = [['hr', 'hrvatski'], ['en', 'engleski']] as const
const MAP_LAT_MIN = MAP_FRAME.south - 0.05
const MAP_LAT_MAX = MAP_FRAME.north + 0.05
const MAP_LNG_MIN = MAP_FRAME.west - 0.05
const MAP_LNG_MAX = MAP_FRAME.east + 0.05

function mapCoordinateInBounds(lat: number, lng: number) {
  return lat >= MAP_LAT_MIN && lat <= MAP_LAT_MAX && lng >= MAP_LNG_MIN && lng <= MAP_LNG_MAX
}

/** Validates optional map layout on a challenge question (admin snapshots and generated content). */
export function validateQuestionDisplay(
  value: unknown,
  path: string,
  optionCount: number,
  prefix: string,
  add: (path: string, message: string) => void
): QuestionDisplay | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) {
    add(`${prefix}${path}.display`, 'Prikaz karte nije ispravan.')
    return undefined
  }
  if (value.type === 'map-target') {
    const point = isRecord(value.point) ? value.point : null
    const lat = point?.lat
    const lng = point?.lng
    if (typeof lat !== 'number' || typeof lng !== 'number' || !mapCoordinateInBounds(lat, lng)) {
      add(`${prefix}${path}.display`, 'Točka na karti nije u području.')
      return undefined
    }
    return { type: 'map-target', point: { lat, lng } }
  }
  if (value.type === 'map-points') {
    if (!Array.isArray(value.points) || value.points.length !== optionCount) {
      add(`${prefix}${path}.display`, 'Točke na karti moraju odgovarati odgovorima.')
      return undefined
    }
    const points: { lat: number, lng: number }[] = []
    for (let i = 0; i < value.points.length; i++) {
      const raw = value.points[i]
      const pt = isRecord(raw) ? raw : null
      const lat = pt?.lat
      const lng = pt?.lng
      if (typeof lat !== 'number' || typeof lng !== 'number' || !mapCoordinateInBounds(lat, lng)) {
        add(`${prefix}${path}.display.points.${i}`, 'Točka na karti nije u području.')
        return undefined
      }
      points.push({ lat, lng })
    }
    return { type: 'map-points', points }
  }
  add(`${prefix}${path}.display`, 'Prikaz karte nije ispravan.')
  return undefined
}

/**
 * A challenge set as stored in a template: the snapshot shape without `version` and `templateId`,
 * which a snapshot takes from the template row (its revision and id) when a challenge is created.
 */
export type ChallengeTemplateContent = Omit<ChallengeContent, 'version' | 'templateId'>
export type ChallengeTemplateRound = ChallengeTemplateContent['rounds'][number]

/** The editable fields, as stored. */
export interface ChallengeTemplateValue {
  name: string
  content: ChallengeTemplateContent
  /** The template new fixed challenges are created from; at most one is current, and it is published. */
  isCurrent: boolean
  status: ContentStatus
}

export type ChallengeTemplate = ContentEntity & Omit<ChallengeTemplateValue, 'status'>

export interface ChallengeSummary {
  rounds: number
  questions: number
  /** 100 points per correct answer. */
  maxScore: number
}

export function challengeSummary(content: Pick<ChallengeTemplateContent, 'rounds'>): ChallengeSummary {
  const rounds = Array.isArray(content?.rounds) ? content.rounds : []
  const questions = rounds.reduce((sum, round) => sum + (Array.isArray(round?.questions) ? round.questions.length : 0), 0)
  return { rounds: rounds.length, questions, maxScore: questions * 100 }
}

function byteLength(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length
}

/**
 * Validates and projects template content: known fields only, text trimmed. Issue paths are
 * `prefix` + the field path (`rounds.0.questions.2.options.1.hr`), so a form shows each problem
 * under its own input.
 */
export function validateChallengeTemplateContent(input: unknown, prefix = ''): ContentValidation<ChallengeTemplateContent> {
  const check = issueCollector()
  const body = isRecord(input) ? input : {}
  if (!isRecord(input)) check.add('', 'Sadržaj izazova nedostaje.')
  const ids = new Set<string>()

  const text = (path: string, value: unknown, label: string): ChallengeText => {
    const pair = isRecord(value) ? value : {}
    const [hr, en] = LANGUAGES.map(([lang, language]) =>
      check.required(`${prefix}${path}.${lang}`, pair[lang], CHALLENGE_LIMITS.text, `${label} (${language})`))
    return { hr: hr!, en: en! }
  }

  const list = (path: string, value: unknown, max: number, tooFew: string, tooMany: string, min = 1): unknown[] => {
    const items = Array.isArray(value) ? value : []
    if (items.length < min) check.add(`${prefix}${path}`, tooFew)
    if (items.length > max) check.add(`${prefix}${path}`, tooMany)
    return items.slice(0, max)
  }

  // Ids are generated by the editor; a bad one can only come from the API, so it is a form-level issue.
  const id = (value: unknown, where: string) => {
    if (typeof value !== 'string' || value.length > CHALLENGE_LIMITS.id || !CHALLENGE_ID.test(value)) {
      check.add('', `${where}: identifikator mora biti do ${CHALLENGE_LIMITS.id} slova, brojki, crtica ili podvlaka.`)
      return ''
    }
    return value
  }

  const question = (value: unknown, path: string, where: string): ChallengeQuestion => {
    const item = isRecord(value) ? value : {}
    const questionId = id(item.id, where)
    if (questionId && ids.has(questionId)) check.add('', `${where}: identifikator „${questionId}“ već koristi drugo pitanje.`)
    if (questionId) ids.add(questionId)
    if (item.mechanic !== CHALLENGE_MECHANIC) check.add('', `${where}: podržana su samo pitanja s ponuđenim odgovorima.`)
    const prompt = text(`${path}.prompt`, item.prompt, 'Pitanje')
    const options = list(`${path}.options`, item.options, CHALLENGE_LIMITS.maxOptions,
      `Pitanje treba barem ${CHALLENGE_LIMITS.minOptions} ponuđena odgovora.`,
      `Pitanje može imati najviše ${CHALLENGE_LIMITS.maxOptions} ponuđena odgovora.`, CHALLENGE_LIMITS.minOptions)
      .map((option, index) => text(`${path}.options.${index}`, option, `Odgovor ${index + 1}`))
    for (const [lang, language] of LANGUAGES) {
      const seen = new Set<string>()
      options.forEach((option, index) => {
        const key = option[lang].toLocaleLowerCase(lang)
        if (key && seen.has(key)) check.add(`${prefix}${path}.options.${index}.${lang}`, `Odgovori se moraju razlikovati (${language}).`)
        seen.add(key)
      })
    }
    const correct = item.correct
    if (typeof correct !== 'number' || !Number.isInteger(correct) || correct < 0 || correct >= Math.max(options.length, 1)) {
      check.add(`${prefix}${path}.correct`, 'Označi točan odgovor.')
    }
    let card: CardKey | undefined
    if (item.card !== undefined) {
      if (typeof item.card !== 'string' || !CARD_KEY.test(item.card)) {
        check.add(`${prefix}${path}.card`, 'Kartica pitanja nije ispravna.')
      } else {
        card = item.card as CardKey
      }
    }
    const display = validateQuestionDisplay(item.display, path, options.length, prefix, check.add)
    const base: ChallengeQuestion = {
      id: questionId,
      mechanic: CHALLENGE_MECHANIC,
      prompt,
      options,
      correct: typeof correct === 'number' && Number.isInteger(correct) ? correct : 0,
      explanation: text(`${path}.explanation`, item.explanation, 'Objašnjenje')
    }
    const withCard = card === undefined ? base : { ...base, card }
    return display === undefined ? withCard : { ...withCard, display }
  }

  const meta = (value: unknown): ChallengeMeta | undefined => {
    if (value === undefined) return undefined
    if (!isRecord(value)) {
      check.add(`${prefix}meta`, 'Meta podaci nisu ispravni.')
      return undefined
    }
    const source = value.source
    if (source !== 'random' && source !== 'set' && source !== 'quiz') {
      check.add(`${prefix}meta.source`, 'Izvor izazova nije ispravan.')
    }
    let topics: TopicId[] | undefined
    if (value.topics !== undefined) {
      if (!Array.isArray(value.topics) || value.topics.length > 8) {
        check.add(`${prefix}meta.topics`, 'Teme meta podataka nisu ispravne.')
      } else {
        topics = value.topics.map((topic, index) => {
          if (typeof topic !== 'string' || !TOPIC_ID.test(topic)) check.add(`${prefix}meta.topics.${index}`, 'Tema nije ispravna.')
          return topic as TopicId
        })
      }
    }
    let game: ChallengeMeta['game']
    if (value.game !== undefined) {
      const allowed = new Set<string>([...CHALLENGEABLE_GAMES, 'mjesovito'])
      if (typeof value.game !== 'string' || !allowed.has(value.game)) {
        check.add(`${prefix}meta.game`, 'Igra meta podataka nije ispravna.')
      } else {
        game = value.game as ChallengeMeta['game']
      }
    }
    let difficulty: Difficulty | undefined
    if (value.difficulty !== undefined) {
      if (typeof value.difficulty !== 'string' || !DIFFICULTIES.has(value.difficulty as Difficulty)) {
        check.add(`${prefix}meta.difficulty`, 'Težina meta podataka nije ispravna.')
      } else {
        difficulty = value.difficulty as Difficulty
      }
    }
    if (check.issues.some(i => i.path.startsWith(`${prefix}meta`))) return undefined
    return {
      source: source as ChallengeMeta['source'],
      ...(topics ? { topics } : {}),
      ...(game ? { game } : {}),
      ...(difficulty ? { difficulty } : {})
    }
  }

  const sample = body.sample
  if (typeof sample !== 'boolean') check.add(`${prefix}sample`, 'Odaberi je li izazov uzorak.')
  const title = text('title', body.title, 'Naslov')
  const validatedMeta = meta(body.meta)
  const rounds = list('rounds', body.rounds, CHALLENGE_LIMITS.rounds,
    'Dodaj barem jedan krug.', `Izazov može imati najviše ${CHALLENGE_LIMITS.rounds} krugova.`).map((value, r) => {
    const round = isRecord(value) ? value : {}
    const path = `rounds.${r}`
    return {
      id: id(round.id, `Krug ${r + 1}`),
      topic: text(`${path}.topic`, round.topic, 'Tema'),
      questions: list(`${path}.questions`, round.questions, CHALLENGE_LIMITS.questionsPerRound,
        'Dodaj barem jedno pitanje u ovaj krug.', `Krug može imati najviše ${CHALLENGE_LIMITS.questionsPerRound} pitanja.`)
        .map((item, q) => question(item, `${path}.questions.${q}`, `Krug ${r + 1}, pitanje ${q + 1}`))
    }
  })
  const value: ChallengeTemplateContent = {
    sample: sample === true,
    title,
    rounds,
    ...(validatedMeta ? { meta: validatedMeta } : {})
  }
  if (!check.issues.length && byteLength(value) > CHALLENGE_LIMITS.contentBytes) {
    check.add('', `Izazov je prevelik (najviše ${Math.floor(CHALLENGE_LIMITS.contentBytes / 1024)} KiB). Skrati tekstove ili ga podijeli na dva.`)
  }
  return { value, issues: check.issues }
}

/** The admin resource's validator: name, content, the current flag and status. */
export function validateChallengeTemplate(input: unknown): ContentValidation<ChallengeTemplateValue> {
  const check = issueCollector()
  const body = isRecord(input) ? input : {}
  if (!isRecord(input)) check.add('', 'Podaci izazova nedostaju.')
  const name = check.required('name', body.name, CHALLENGE_LIMITS.name, 'Naziv')
  const content = validateChallengeTemplateContent(body.content, 'content.')
  check.issues.push(...content.issues)
  const isCurrent = body.isCurrent ?? false
  if (typeof isCurrent !== 'boolean') check.add('isCurrent', 'Vrijednost polja „Trenutni izazov“ nije dopuštena.')
  const status = contentStatus(body.status, 'published', check.add)
  if (isCurrent === true && status !== 'published') {
    check.add('isCurrent', 'Trenutni izazov mora biti objavljen.')
  }
  return { value: { name, content: content.value, isCurrent: isCurrent === true, status }, issues: check.issues }
}

/**
 * Validates a challenge snapshot (what `heritage_challenges.content` stores): template content plus
 * `version` and, for snapshots of a template, `templateId`. Throws on the first problem, because a
 * snapshot is built by the server and an invalid one is a bug, not user input.
 */
export function validateChallengeContent(input: unknown): ChallengeContent {
  const body = isRecord(input) ? input : {}
  const { value, issues } = validateChallengeTemplateContent(input)
  const extra: ContentIssue[] = []
  const version = body.version
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) extra.push({ path: 'version', message: 'Verzija mora biti pozitivan cijeli broj.' })
  if (body.templateId !== undefined && !isUuid(body.templateId)) extra.push({ path: 'templateId', message: 'Identifikator predloška mora biti UUID.' })
  const first = [...extra, ...issues][0]
  if (first) throw new Error(`Invalid challenge content: ${first.path || '(content)'}: ${first.message}`)
  return {
    version: version as number,
    ...(body.templateId === undefined ? {} : { templateId: (body.templateId as string).toLowerCase() }),
    ...value
  }
}

/**
 * A challenge set split into labelled parts for the change history (`HistoryFieldMeta.entries`): the
 * title, the sample flag, then per round its topic and question order, and per question its prompt,
 * choices, correct answer and explanation. Keys use round and question ids, so moving a round or a
 * question shows only as a changed order. Tolerates malformed history data: missing parts are skipped.
 */
export function challengeContentEntries(input: unknown): Array<{ key: string, label: string, value: string }> {
  const entries: Array<{ key: string, label: string, value: string }> = []
  const content = isRecord(input) ? input : {}
  const str = (value: unknown) => typeof value === 'string' ? value : ''
  const pair = (key: string, label: string, value: unknown) => {
    const text = isRecord(value) ? value : {}
    for (const [lang] of LANGUAGES) entries.push({ key: `${key}.${lang}`, label: `${label} (${lang})`, value: str(text[lang]) })
  }
  pair('title', 'Naslov', content.title)
  if (typeof content.sample === 'boolean') entries.push({ key: 'sample', label: 'Uzorak', value: content.sample ? 'Da' : 'Ne' })
  const rounds = Array.isArray(content.rounds) ? content.rounds.filter(isRecord) : []
  entries.push({ key: 'rounds', label: 'Redoslijed krugova', value: rounds.map(round => str(isRecord(round.topic) ? round.topic.hr : '')).join('\n') })
  rounds.forEach((round, r) => {
    const roundKey = `round:${str(round.id) || r}`
    const roundLabel = `Krug ${r + 1}`
    pair(`${roundKey}.topic`, `${roundLabel}, tema`, round.topic)
    const questions = Array.isArray(round.questions) ? round.questions.filter(isRecord) : []
    entries.push({
      key: `${roundKey}.questions`,
      label: `${roundLabel}, redoslijed pitanja`,
      value: questions.map(question => str(isRecord(question.prompt) ? question.prompt.hr : '')).join('\n')
    })
    questions.forEach((question, q) => {
      const key = `question:${str(question.id) || `${r}.${q}`}`
      const label = `${roundLabel}, pitanje ${q + 1}`
      pair(`${key}.prompt`, label, question.prompt)
      const options = Array.isArray(question.options) ? question.options : []
      options.forEach((option, o) => pair(`${key}.options.${o}`, `${label}, odgovor ${o + 1}`, option))
      const correct = typeof question.correct === 'number' ? question.correct : -1
      const right = isRecord(options[correct]) ? str((options[correct] as Record<string, unknown>).hr) : ''
      entries.push({ key: `${key}.correct`, label: `${label}, točan odgovor`, value: correct >= 0 ? `${correct + 1}. ${right}`.trim() : '' })
      pair(`${key}.explanation`, `${label}, objašnjenje`, question.explanation)
    })
  })
  return entries
}
