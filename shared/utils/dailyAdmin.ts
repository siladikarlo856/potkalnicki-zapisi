// Types and limits shared by the reviewer-only daily word schedule routes and the admin card.

/** How far ahead a word can be pinned, counted from today in Europe/Zagreb. */
export const DAILY_PIN_HORIZON_DAYS = 366
/** Request body cap for PUT /api/review/daily/[day]. */
export const DAILY_PIN_BODY_LIMIT = 8 * 1024
/** Fewer days than this without a repeat is reported to the admin. */
export const DAILY_RUNWAY_WARNING_DAYS = 14

export interface DailyAdminWarning {
  code: 'pin-inactive' | 'pin-not-ready' | 'previously-used' | 'runway-short' | 'ready-short'
  /** Croatian text for the admin screen. */
  message: string
  day?: string
  wordId?: string
}

export interface DailyAdminDay {
  day: string
  wordId: string
  headword: string
  /** False when the word has been deactivated or is no longer valid. */
  active: boolean
  source: 'pinned' | 'auto'
  /** 'auto', 'none' or an area id. */
  village: string
  resolved: boolean
  resolvedAt: string | null
  replacedWordIds: string[]
}

export interface DailyAdminOverview {
  /** The current Europe/Zagreb day, decided by the server. */
  day: string
  /** Today's row, or null while nobody has opened today's word yet. */
  today: DailyAdminDay | null
  /** The last resolved days before today, newest first. */
  recent: DailyAdminDay[]
  /** Every row after today, earliest first. */
  pins: DailyAdminDay[]
  runway: {
    /** Active words never shown, withdrawn or reserved by a pin, that are fully daily-ready. */
    readyUnused: number
    /** Active words never shown, withdrawn or reserved by a pin. */
    unused: number
    active: number
    /** Days that can still be filled without repeating a word: unused words plus active pins. */
    daysLeft: number
  }
  warnings: DailyAdminWarning[]
}

export interface DailyPinInput {
  wordId: string
  /** 'auto' (default), 'none' or one of the word's area ids. */
  village?: string
}

export interface DailyPinResult {
  day: string
  wordId: string
  headword: string
  village: string
  source: 'pinned'
  warnings: DailyAdminWarning[]
}
