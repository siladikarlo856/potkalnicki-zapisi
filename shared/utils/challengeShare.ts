import type { ChallengeMeta } from './challenge'
import type { CardPool, TopicId } from './learn/types'
import type { Difficulty, GenerateGameId } from './games/types'

const GAME_LABELS: Record<GenerateGameId, { hr: string, en: string }> = {
  'mjesovito': { hr: 'Mješovito', en: 'Mixed' },
  'znacenje': { hr: 'Kaj to znači?', en: 'What does it mean?' },
  'rijec': { hr: 'Kak se to veli?', en: 'Local word' },
  'opcina': { hr: 'Kojoj općini pripada?', en: 'Which municipality?' },
  'crkva': { hr: 'Gdje je ta crkva?', en: 'Where is the church?' },
  'karta-koje': { hr: 'Koje je ovo selo?', en: 'Which village is this?' },
  'karta-tocke': { hr: 'Pronađi selo', en: 'Find the village' },
  'klub-mjesto': { hr: 'Koji klub igra u mjestu?', en: 'Which club plays in the settlement?' },
  'klub-liga': { hr: 'U kojoj ligi klub igra u sezoni?', en: 'Which league does the club play in?' },
  'klub-odakle': { hr: 'Odakle je klub?', en: 'Where is the club from?' }
}

const DIFFICULTY_LABELS: Record<Difficulty, { hr: string, en: string }> = {
  lako: { hr: 'Lako', en: 'Easy' },
  srednje: { hr: 'Srednje', en: 'Medium' },
  tesko: { hr: 'Teško', en: 'Hard' }
}

const ROOT_TOPIC_EN: Record<string, string> = {
  rijeci: 'Words',
  mjesta: 'Places',
  bastina: 'Heritage'
}

export function challengeGameLabel(game: GenerateGameId, lang: 'hr' | 'en'): string {
  return GAME_LABELS[game][lang]
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
