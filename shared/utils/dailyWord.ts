import type { Area, WordEntry } from '../../app/types/heritage'

export const DAILY_CATEGORIES = ['house', 'yard', 'clothing', 'food', 'time', 'weather', 'people', 'body', 'animals', 'work', 'customs', 'feelings', 'function'] as const
export type DailyCategory = typeof DAILY_CATEGORIES[number]
export type DailyText = { hr: string, en?: string }
export type DailyClue
  = { kind: 'example', text: string }
    | { kind: 'category', category: DailyCategory }
    | { kind: 'variants', forms: string[] }
    | { kind: 'partOfSpeech', text: string }
    | { kind: 'areas', areaIds: string[] }

/** The answer is public: v1 stats are personal, never authoritative server scores. */
export interface DailyWordPayload {
  day: string
  number: number
  nextAt: string
  sample: boolean
  entry: WordEntry
  areas: Area[]
  villageAreaId: string | null
  options: { id: string, text: DailyText }[]
  correctOptionId: string
  clues: DailyClue[]
}

// Reserved future sentinel, not a launch date. Set only after 30 verified,
// daily-ready words exist; core logic alone must not enable the feature.
export const DAILY_WORD_EPOCH = '9999-01-01'
const DAY_MS = 86_400_000
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Zagreb', year: 'numeric', month: '2-digit', day: '2-digit'
})
const offsetFormatter = new Intl.DateTimeFormat('en', {
  timeZone: 'Europe/Zagreb', timeZoneName: 'longOffset'
})

export function zagrebDay(date: Date): string {
  const parts = dayFormatter.formatToParts(date)
  const part = (name: string) => parts.find(part => part.type === name)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function dayUtc(day: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new RangeError('Invalid day key')
  const value = Date.parse(`${day}T00:00:00.000Z`)
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== day) throw new RangeError('Invalid day key')
  return value
}

export function addDays(day: string, count: number): string {
  if (!Number.isInteger(count)) throw new RangeError('Day increment must be an integer')
  return new Date(dayUtc(day) + count * DAY_MS).toISOString().slice(0, 10)
}

/** Positive when b is later than a. Calendar arithmetic, independent of DST. */
export function dayDiff(a: string, b: string): number {
  return (dayUtc(b) - dayUtc(a)) / DAY_MS
}

export function zagrebMidnightUtc(day: string): Date {
  const utc = dayUtc(day)
  const offsetAt = (instant: number) => {
    const offset = offsetFormatter.formatToParts(new Date(instant)).find(part => part.type === 'timeZoneName')!.value
    const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(offset)
    if (!match) throw new RangeError('Unsupported Zagreb offset')
    return (match[1] === '+' ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3])) * 60_000
  }
  const first = utc - offsetAt(utc)
  return new Date(utc - offsetAt(first))
}

/** Nonpositive before launch; the future API must return not-started then. */
export function dailyWordNumber(day: string): number {
  return dayDiff(DAILY_WORD_EPOCH, day) + 1
}

export interface DailyGame {
  optionsLeft: string[]
  guesses: string[]
  cluesShown: number
  done: boolean
  solved: boolean
}

type DailyPuzzle = Pick<DailyWordPayload, 'options' | 'correctOptionId' | 'clues'>

export function startDailyGame(payload: DailyPuzzle): DailyGame {
  return { optionsLeft: payload.options.map(option => option.id), guesses: [], cluesShown: 0, done: false, solved: false }
}

export function guessDailyWord(game: DailyGame, payload: DailyPuzzle, optionId: string): DailyGame {
  if (game.done || !game.optionsLeft.includes(optionId)) return game
  const guesses = [...game.guesses, optionId]
  const solved = optionId === payload.correctOptionId
  return {
    optionsLeft: solved ? [...game.optionsLeft] : game.optionsLeft.filter(id => id !== optionId),
    guesses,
    cluesShown: solved ? game.cluesShown : Math.min(guesses.length, payload.clues.length),
    done: solved || guesses.length >= payload.options.length - 1,
    solved
  }
}

export interface DailyProgress {
  wordId: string
  guesses: string[]
  done: boolean
  solved: boolean
  tries: number
  maxTries: number
  finishedAt?: string
}

export interface DailyStats {
  streak: number
  maxStreak: number
  played: number
  percentCorrect: number
  distribution: Record<'1' | '2' | '3' | 'X', number>
}

/** Consume validated device records and the server-provided day, never device time. */
export function deriveDailyStats(days: Readonly<Record<string, DailyProgress>>, today: string): DailyStats {
  const completed = Object.keys(days).filter(day => day <= today && days[day]!.done).sort()
  const distribution: DailyStats['distribution'] = { 1: 0, 2: 0, 3: 0, X: 0 }
  let solved = 0
  let run = 0
  let maxStreak = 0
  let previous: string | undefined
  for (const day of completed) {
    const result = days[day]!
    run = previous && dayDiff(previous, day) === 1 ? run + 1 : 1
    maxStreak = Math.max(maxStreak, run)
    previous = day
    if (result.solved) {
      solved++
      if (result.tries === 1 || result.tries === 2 || result.tries === 3) distribution[result.tries]++
    } else distribution.X++
  }
  let streak = 0
  let day = days[today]?.done ? today : addDays(today, -1)
  while (days[day]?.done) {
    streak++
    day = addDays(day, -1)
  }
  return { streak, maxStreak, played: completed.length, percentCorrect: completed.length ? Math.round(100 * solved / completed.length) : 0, distribution }
}

/** Only completed results can be shared. No word or clue data is accepted. */
export function dailyWordShareText(number: number, result: Pick<DailyProgress, 'done' | 'solved' | 'tries' | 'maxTries'>, locale: 'hr' | 'en' = 'hr'): string {
  if (!result.done) return ''
  const { solved, tries, maxTries } = result
  const squares = '🟥'.repeat(solved ? tries - 1 : tries) + (solved ? '🟩' : '') + '⬜'.repeat(maxTries - tries)
  return `Riječ dana #${number}: ${solved ? tries : 'X'}/${maxTries}\n${squares}\nhttps://karlo-siladi.from.hr${locale === 'en' ? '/en' : ''}/heritage#rijec-dana`
}
