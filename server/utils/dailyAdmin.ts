import type { SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import { addDays, dailyReadiness, zagrebDay } from '../../shared/utils/dailyWord'
import type { DailyReadiness } from '../../shared/utils/dailyWord'
import { DAILY_PIN_BODY_LIMIT, DAILY_PIN_HORIZON_DAYS, DAILY_RUNWAY_WARNING_DAYS } from '../../shared/utils/dailyAdmin'
import type { DailyAdminDay, DailyAdminOverview, DailyAdminWarning, DailyPinResult } from '../../shared/utils/dailyAdmin'
import { validateWord } from '../../shared/utils/word'
import { activeCandidates, allRows } from './dailyWord'
import { loadAreaIndex, projectAreas } from './wordAreas'
import type { Candidate, DailyRow } from './dailyWord'

// Reviewer-only schedule routes. They reuse the resolver's reads (all active words, all rows)
// and the table written by the public route; a pin is an unresolved row for a future day that
// the resolver turns into the day's word on the first request.

const WORDS = 'heritage_words'
const DAILY = 'heritage_daily_words'
const ID_PATTERN = /^[\w~-]{1,200}$/
const LOOKUP_CHUNK = 50
const MISSING_LABELS: Record<DailyReadiness['missing'][number], string> = {
  example: 'primjer', category: 'kategorija', distractors: 'netočni odgovori'
}

/** An English status line for clients plus the Croatian text the admin screen shows. */
function refuse(statusCode: number, statusMessage: string, message: string): never {
  throw createError({ statusCode, statusMessage, data: { message } })
}

export function dayParam(event: H3Event) {
  const day = getRouterParam(event, 'day') ?? ''
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new RangeError('format')
    addDays(day, 0)
  } catch {
    refuse(400, 'Invalid day', 'Datum mora biti u obliku GGGG-MM-DD.')
  }
  return day
}

function assertFuture(day: string, today: string) {
  if (day <= today) refuse(400, 'Only future days can be changed', 'Mijenjati se mogu samo budući dani. Današnja riječ i prošle riječi su zaključane.')
}

async function headwords(client: SupabaseClient, ids: readonly string[], known: ReadonlyMap<string, Candidate>) {
  const result = new Map<string, { headword: string, active: boolean }>()
  const missing: string[] = []
  for (const id of new Set(ids)) {
    const word = known.get(id)
    if (word) result.set(id, { headword: word.entry.headword, active: true })
    else missing.push(id)
  }
  for (let i = 0; i < missing.length; i += LOOKUP_CHUNK) {
    const { data, error } = await client.from(WORDS).select('id,entry').in('id', missing.slice(i, i + LOOKUP_CHUNK))
    if (error) databaseError(error)
    for (const row of data) {
      const headword = (row.entry as { headword?: unknown } | null)?.headword
      result.set(row.id, { headword: typeof headword === 'string' ? headword : row.id, active: false })
    }
  }
  return result
}

function view(row: DailyRow, names: ReadonlyMap<string, { headword: string, active: boolean }>): DailyAdminDay {
  const word = names.get(row.word_id)
  return {
    day: row.day,
    wordId: row.word_id,
    headword: word?.headword ?? row.word_id,
    active: word?.active ?? false,
    source: row.source,
    village: row.village,
    resolved: !!row.resolved_at,
    resolvedAt: row.resolved_at,
    replacedWordIds: row.replaced_word_ids
  }
}

/** The latest earlier day this word was shown (or withdrawn on), if any. */
function lastShown(rows: readonly DailyRow[], wordId: string, today: string, except?: string) {
  let latest: string | null = null
  for (const row of rows) {
    if (row.day > today || row.day === except) continue
    const shown = (row.word_id === wordId && !!row.resolved_at) || row.replaced_word_ids.includes(wordId)
    if (shown && (!latest || row.day > latest)) latest = row.day
  }
  return latest
}

function pinWarnings(day: string, word: { id: string, headword: string }, candidate: Candidate | undefined, pool: readonly Candidate[], rows: readonly DailyRow[], today: string): DailyAdminWarning[] {
  const base = { day, wordId: word.id }
  const warnings: DailyAdminWarning[] = []
  if (!candidate) {
    warnings.push({ ...base, code: 'pin-inactive', message: `Prikvačena riječ „${word.headword}“ za ${day} nije aktivna ili nije valjana pa će se preskočiti i dan dobiva drugu riječ.` })
    return warnings
  }
  const { ready, missing } = dailyReadiness(candidate.entry, pool.map(item => item.entry))
  if (!ready) {
    warnings.push({ ...base, code: 'pin-not-ready', message: `Riječ „${word.headword}“ (${day}) nema: ${missing.map(name => MISSING_LABELS[name]).join(', ')}. Igrač će vidjeti zamjenske tragove.` })
  }
  const used = lastShown(rows, word.id, today, day)
  if (used) warnings.push({ ...base, code: 'previously-used', message: `Riječ „${word.headword}“ već je bila riječ dana (${used}). Ponavljanje je dopušteno.` })
  return warnings
}

export async function dailyOverview(client: SupabaseClient, now = new Date()): Promise<DailyAdminOverview> {
  const today = zagrebDay(now)
  // Every active word and every schedule row, not a page of the admin list.
  const [pool, rows] = await Promise.all([activeCandidates(client), allRows(client)])
  const byId = new Map(pool.map(word => [word.id, word]))
  const recentRows = rows.filter(row => row.day < today && row.resolved_at).slice(-30).reverse()
  const todayRow = rows.find(row => row.day === today) ?? null
  const pinRows = rows.filter(row => row.day > today)
  const names = await headwords(client, [...recentRows, ...pinRows, ...(todayRow ? [todayRow] : [])].map(row => row.word_id), byId)

  // Same notion of "used" as the picker: any word with a row, or replaced on a row.
  const reserved = new Set<string>()
  for (const row of rows) {
    reserved.add(row.word_id)
    for (const id of row.replaced_word_ids) reserved.add(id)
  }
  const entries = pool.map(word => word.entry)
  const unused = pool.filter(word => !reserved.has(word.id))
  const readyUnused = unused.filter(word => dailyReadiness(word.entry, entries).ready).length
  const activePins = pinRows.filter(row => byId.has(row.word_id)).length
  const daysLeft = unused.length + activePins

  const warnings: DailyAdminWarning[] = []
  if (daysLeft < DAILY_RUNWAY_WARNING_DAYS) {
    warnings.push({ code: 'runway-short', message: `Zaliha riječi: samo ${daysLeft} ${daysLeft % 10 === 1 && daysLeft % 100 !== 11 ? 'dan' : 'dana'} bez ponavljanja (manje od ${DAILY_RUNWAY_WARNING_DAYS}). Kad se sve riječi iskoriste, ponavlja se najdavnije prikazana.` })
  } else if (readyUnused < DAILY_RUNWAY_WARNING_DAYS) {
    warnings.push({ code: 'ready-short', message: `Potpuno spremnih riječi (primjer, kategorija i netočni odgovori) ima samo ${readyUnused}. Ostali dani koriste zamjenske tragove.` })
  }
  for (const row of pinRows) {
    warnings.push(...pinWarnings(row.day, { id: row.word_id, headword: names.get(row.word_id)?.headword ?? row.word_id }, byId.get(row.word_id), pool, rows, today))
  }

  return {
    day: today,
    today: todayRow ? view(todayRow, names) : null,
    recent: recentRows.map(row => view(row, names)),
    pins: pinRows.map(row => view(row, names)),
    runway: { readyUnused, unused: unused.length, active: pool.length, daysLeft },
    warnings
  }
}

async function readPinBody(event: H3Event) {
  const body = await readBody(event).catch(() => null)
  if (Buffer.byteLength(JSON.stringify(body) ?? '') > DAILY_PIN_BODY_LIMIT) refuse(413, 'Pin too large', 'Zahtjev je prevelik.')
  const input = body as { wordId?: unknown, village?: unknown } | null
  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.wordId !== 'string' || !ID_PATTERN.test(input.wordId)) {
    refuse(400, 'Invalid pin', 'Odaberi riječ.')
  }
  const village = input.village ?? 'auto'
  if (typeof village !== 'string' || village.length < 1 || village.length > 200) refuse(400, 'Invalid village', 'Neispravan odabir mjesta.')
  return { wordId: input.wordId, village }
}

export async function pinDailyWord(client: SupabaseClient, event: H3Event, day: string, now = new Date()): Promise<DailyPinResult> {
  const today = zagrebDay(now)
  assertFuture(day, today)
  if (day > addDays(today, DAILY_PIN_HORIZON_DAYS)) {
    refuse(400, 'Day too far ahead', `Riječ se može prikvačiti najviše ${DAILY_PIN_HORIZON_DAYS} dana unaprijed.`)
  }
  const { wordId, village } = await readPinBody(event)

  const found = await client.from(WORDS).select('id,entry,active').eq('id', wordId)
  if (found.error) databaseError(found.error)
  const stored = found.data[0]
  if (!stored) refuse(404, 'Word not found', 'Riječ ne postoji.')
  const parsed = validateWord({ entry: stored.entry, areas: projectAreas(stored.entry, await loadAreaIndex(client)), active: true }, wordId)
  if (!stored.active || parsed.issues.length) refuse(400, 'Word is not active', 'Riječ nije aktivna. Prikvačiti se mogu samo aktivne riječi.')
  if (village !== 'auto' && village !== 'none' && !parsed.value.areas.some(area => area.id === village)) {
    refuse(400, 'Invalid village', 'Mjesto mora biti jedno od mjesta ove riječi.')
  }

  const rows = await allRows(client)
  const existing = rows.find(row => row.day === day)
  if (existing?.resolved_at) refuse(409, 'Day already resolved', 'Za taj je dan riječ već odabrana i zaključana.')
  const elsewhere = rows.find(row => row.day > today && row.day !== day && row.word_id === wordId)
  if (elsewhere) refuse(409, 'Word already pinned', `Ta je riječ već prikvačena za ${elsewhere.day}.`)

  const values = { word_id: wordId, source: 'pinned' as const, village }
  if (existing) {
    // Conditional, so a request that resolves the day in between cannot be overwritten.
    const { data, error } = await client.from(DAILY).update(values).eq('day', day).is('resolved_at', null).select('day')
    if (error) databaseError(error)
    if (!data.length) refuse(409, 'Day already resolved', 'Za taj je dan riječ već odabrana i zaključana.')
  } else {
    const { error } = await client.from(DAILY).insert({ day, ...values })
    if (error?.code === '23505') refuse(409, 'Day already taken', 'Za taj je dan upravo spremljena druga riječ. Osvježi i pokušaj opet.')
    if (error) databaseError(error)
  }

  const pool = await activeCandidates(client)
  const candidate = pool.find(word => word.id === wordId)
  return {
    day, wordId, headword: parsed.value.entry.headword, village, source: 'pinned',
    warnings: pinWarnings(day, { id: wordId, headword: parsed.value.entry.headword }, candidate, pool, rows, today)
  }
}

export async function unpinDailyWord(client: SupabaseClient, day: string, now = new Date()) {
  assertFuture(day, zagrebDay(now))
  const found = await client.from(DAILY).select('*').eq('day', day)
  if (found.error) databaseError(found.error)
  const row = found.data[0] as DailyRow | undefined
  if (!row) refuse(404, 'Nothing pinned', 'Za taj dan nema prikvačene riječi.')
  if (row.resolved_at) refuse(409, 'Day already resolved', 'Za taj je dan riječ već odabrana i zaključana.')
  const { data, error } = await client.from(DAILY).delete().eq('day', day).is('resolved_at', null).select('day')
  if (error) databaseError(error)
  if (!data.length) refuse(409, 'Day already resolved', 'Za taj je dan riječ već odabrana i zaključana.')
  return { day, removed: true as const }
}
