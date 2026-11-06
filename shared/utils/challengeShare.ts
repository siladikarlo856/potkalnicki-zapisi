import type { ChallengeMeta } from './challenge'
import type { CardPool, TopicId } from './learn/types'
import type { Difficulty, GenerateGameId } from './games/types'
import { gameDefinition } from './games/definitions'

/** The mixed game draws from several games, so it has no Game definition of its own. */
const MIXED_GAME_LABEL = { hr: 'Mješovito', en: 'Mixed' }

const DIFFICULTY_LABELS: Record<Difficulty, { hr: string, en: string }> = {
  lako: { hr: 'Lako', en: 'Easy' },
  srednje: { hr: 'Srednje', en: 'Medium' },
  tesko: { hr: 'Teško', en: 'Hard' }
}

const ROOT_TOPIC_EN: Record<string, string> = {
  rijeci: 'Words',
  mjesta: 'Places',
  bastina: 'Heritage',
  osobe: 'Persons',
  sport: 'Sport and clubs'
}

export function challengeGameLabel(game: GenerateGameId, lang: 'hr' | 'en'): string {
  if (game === 'mjesovito') return MIXED_GAME_LABEL[lang]
  return gameDefinition(game).label[lang]
}

export function challengeDifficultyLabel(difficulty: Difficulty, lang: 'hr' | 'en'): string {
  return DIFFICULTY_LABELS[difficulty][lang]
}

export function challengeTopicSummary(
  topics: TopicId[],
  pool: Pick<CardPool, 'topics'> | undefined,
  lang: 'hr' | 'en'
): string {
  const labels = topics.map((id) => {
    const fromPool = pool?.topics.find(t => t.id === id)?.label
    if (lang === 'hr') return fromPool ?? id
    return ROOT_TOPIC_EN[id] ?? fromPool ?? id
  })
  return labels.join(lang === 'hr' ? ' · ' : ' + ')
}

export function challengeMetaTopicSummary(meta: ChallengeMeta, pool: Pick<CardPool, 'topics'> | undefined, lang: 'hr' | 'en'): string {
  if (meta.topics?.length) return challengeTopicSummary(meta.topics, pool, lang)
  return lang === 'hr' ? 'Riječi · Mjesta · Baština' : 'Words + Places + Heritage'
}

function formatClosesDayMonth(closesAt: Date | string, lang: 'hr' | 'en'): string {
  const date = typeof closesAt === 'string' ? new Date(closesAt) : closesAt
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'hr-HR', { day: 'numeric', month: 'numeric' }).format(date)
}

/** Shareable challenge invite line for WhatsApp, Viber and native share. */
export function challengeInviteShareText(options: {
  nickname: string
  url: string
  questionCount: number
  closesAt: Date | string
  meta?: ChallengeMeta | null
  pool?: Pick<CardPool, 'topics'>
  lang?: 'hr' | 'en'
  targetScore?: number | null
}): string {
  const lang = options.lang ?? 'hr'
  const difficulty = options.meta?.difficulty
    ? challengeDifficultyLabel(options.meta.difficulty, lang)
    : (lang === 'hr' ? 'Srednje' : 'Medium')
  const topics = challengeMetaTopicSummary(options.meta ?? { source: 'random' }, options.pool, lang)
  const closes = formatClosesDayMonth(options.closesAt, lang)
  const invite = lang === 'hr'
    ? `${options.nickname} te izaziva: ${options.questionCount} pitanja · ${difficulty} · ${topics} · otvoreno do ${closes} → ${options.url}`
    : `${options.nickname} challenges you: ${options.questionCount} questions · ${difficulty} · ${topics} · open until ${closes} → ${options.url}`
  if (options.targetScore != null) {
    const target = lang === 'hr'
      ? `Rezultat za dostići: ${options.targetScore} bodova`
      : `Score to beat: ${options.targetScore} points`
    return `${invite}\n${target}`
  }
  return invite
}
