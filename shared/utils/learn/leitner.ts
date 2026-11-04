export const INTERVAL_DAYS: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 21 }

export interface CardProgress {
  box: 0 | 1 | 2 | 3 | 4 | 5
  due: string
  seen: number
  known: number
  missed: number
  lastPlayed: string
}

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000

/** Calendar day arithmetic in YYYY-MM-DD (UTC label math, same as guest progress v1). */
export function addDays(day: string, n: number): string {
  return new Date((dayNumber(day) + n) * 86_400_000).toISOString().slice(0, 10)
}

export function isDue(p: CardProgress, today: string): boolean {
  return p.box >= 1 && p.due <= today
}

export function isLearned(p: CardProgress): boolean {
  return p.box === 5
}

export function applyAnswer(
  p: CardProgress | undefined,
  knew: boolean,
  today: string,
  options?: { countSeen?: boolean }
): CardProgress {
  const base = p ?? { box: 0, due: today, seen: 0, known: 0, missed: 0, lastPlayed: today }
  const box = (knew
    ? Math.min(5, Math.max(base.box, 1) + 1)
    : 1) as CardProgress['box']
  const due = addDays(today, INTERVAL_DAYS[(box || 1) as 1 | 2 | 3 | 4 | 5])
  const countSeen = options?.countSeen !== false
  return {
    box,
    due,
    seen: base.seen + (countSeen ? 1 : 0),
    known: base.known + (knew ? 1 : 0),
    missed: base.missed + (knew ? 0 : 1),
    lastPlayed: today
  }
}
