import type { SupabaseClient } from '@supabase/supabase-js'
import type { Area, WordEntry } from '../../app/types/heritage'
import { DAILY_CATEGORIES, DAILY_WORD_EPOCH, addDays, dailyReadiness, dayDiff, zagrebDay, zagrebMidnightUtc } from '../../shared/utils/dailyWord'
import type { DailyClue, DailyText, DailyWordPayload } from '../../shared/utils/dailyWord'
import { pickDistractors, seededRandom, shuffled } from '../../shared/utils/multipleChoice'
import { validateWord } from '../../shared/utils/word'

// Lazy, persisted daily word resolution. The first request of a Zagreb day writes the day's
// row (word + frozen options/clues); everyone then reads that row. A hash of the date alone
// would reshuffle past and future days whenever the pool changed, cannot avoid repeats and
// cannot carry pins, so the persisted row is the single source of truth.
//
// The correct option is part of the public payload on purpose. v1 stats are personal and
// kept on the device, so a leaked answer only spoils the player's own streak. Community
// stats would need server-side guess checking first.

const WORDS = 'heritage_words'
const DAILY = 'heritage_daily_words'
const PAGE = 1000
const ATTEMPTS = 5
/** About one village-specific word a week, when both kinds are available in a tier. */
export const DAILY_VILLAGE_SHARE = 1 / 7
const VILLAGE_KINDS: readonly Area['kind'][] = ['settlement', 'municipality']

export class DailyWordError extends Error {
  constructor(readonly statusCode: 404, message: 'not-started' | 'no-words') {
    super(message)
  }
}

/** A cached copy may never outlive its day; otherwise keep the 30-second deactivation promise. */
export function dailyCacheControl(nextAt: string, now: Date) {
  const seconds = Math.max(0, Math.min(30, Math.ceil((Date.parse(nextAt) - now.getTime()) / 1000)))
  return `public, max-age=${seconds}, s-maxage=${seconds}, must-revalidate`
}

export interface DailyResolveOptions {
  /** First day the feature is live; defaults to the launch constant. */
  epoch?: string
  villageShare?: number
}

interface Snapshot {
  /** The meaning as it was when the day was resolved, so the reveal matches the options. */
  meaning?: DailyText
  options: { id: string, text: DailyText }[]
  correctOptionId: string
  villageAreaId: string | null
  clues: DailyClue[]
}
interface DailyRow {
  day: string
  word_id: string
  source: 'pinned' | 'auto'
  village: string
  snapshot: Snapshot | null
  resolved_at: string | null
  replaced_word_ids: string[]
}
interface Candidate {
  id: string
  entry: WordEntry
  areas: Area[]
}

function fail(error: { message: string }): never {
  throw new Error(`[daily] Supabase request failed: ${error.message}`)
}

/** FNV-1a: a stable 32-bit seed that does not depend on the runtime. */
function hash(text: string) {
  let value = 0x811C9DC5
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 0x01000193)
  return value >>> 0
}

async function pages<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null, error: { message: string } | null }>) {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1)
    if (error) fail(error)
    rows.push(...data!)
    if (data!.length < PAGE) return rows
  }
}

function candidate(row: { id: string, entry: unknown, areas: unknown }): Candidate | null {
  const parsed = validateWord({ entry: row.entry, areas: row.areas, active: true }, row.id)
  // Fail closed like /api/heritage/words: a direct database edit must not publish a broken word.
  if (parsed.issues.length) return null
  return { id: row.id, entry: parsed.value.entry, areas: parsed.value.areas }
}

/** Every active, valid word. Not capped at the 100 rows the public word list returns. */
async function activeCandidates(client: SupabaseClient) {
  const rows = await pages<{ id: string, entry: unknown, areas: unknown }>((from, to) =>
    client.from(WORDS).select('id,entry,areas').eq('active', true).order('id').range(from, to))
  return rows.map(candidate).filter((word): word is Candidate => !!word)
}

async function activeCandidate(client: SupabaseClient, id: string) {
  const { data, error } = await client.from(WORDS).select('id,entry,areas').eq('id', id).eq('active', true)
  if (error) fail(error)
  return data[0] ? candidate(data[0]) : null
}

async function readRow(client: SupabaseClient, day: string) {
  const { data, error } = await client.from(DAILY).select('*').eq('day', day)
  if (error) fail(error)
  return (data[0] as DailyRow | undefined) ?? null
}

/**
 * The single settlement or municipality a word is used in, or null for a region-wide word.
 * Every usage must map to a place; a usage that maps to nothing (for example only a county)
 * makes the whole word region-wide. Town-kind areas are not mapped.
 */
export function villageAreaId(entry: WordEntry, areas: readonly Area[]): string | null {
  const byId = new Map(areas.map(area => [area.id, area]))
  const found = new Set<string>()
  let usages = 0
  for (const variant of entry.variants) {
    for (const usage of variant.usages) {
      usages++
      const seen = new Set<string>()
      let area = byId.get(usage.areaId)
      let mapped = false
      while (area && !seen.has(area.id)) {
        if (VILLAGE_KINDS.includes(area.kind)) {
          found.add(area.id)
          mapped = true
          break
        }
        seen.add(area.id)
        area = area.parentId ? byId.get(area.parentId) : undefined
      }
      if (!mapped) return null
    }
  }
  return usages > 0 && found.size === 1 ? [...found][0]! : null
}

function usageAreaIds(entry: WordEntry) {
  return [...new Set(entry.variants.flatMap(variant => variant.usages.map(usage => usage.areaId)))]
}

/** Exactly `count` clues, in reveal order. Missing data is replaced by labelled substitutes. */
function buildClues(entry: WordEntry, count: number): DailyClue[] {
  const example = entry.examples?.[0]?.text.trim()
  const forms = [...new Set(entry.variants.map(variant => variant.form.trim()).filter(form => form && form !== entry.headword))]
  const type = entry.partOfSpeech?.trim() ?? ''
  const first: DailyClue = example
    ? { kind: 'example', text: example }
    : forms.length
      ? { kind: 'variants', forms: forms.slice(0, 5) }
      : type ? { kind: 'partOfSpeech', text: type } : { kind: 'areas', areaIds: usageAreaIds(entry) }
  const second: DailyClue = entry.category && (DAILY_CATEGORIES as readonly string[]).includes(entry.category)
    ? { kind: 'category', category: entry.category }
    // An empty area list means the whole region, like a variant without usages.
    : type && first.kind !== 'partOfSpeech' ? { kind: 'partOfSpeech', text: type } : { kind: 'areas', areaIds: usageAreaIds(entry) }
  return [first, second].slice(0, count)
}

function buildOptions(word: Candidate, pool: readonly WordEntry[], day: string) {
  const random = seededRandom(hash(`heritage-daily-options:${day}:${word.id}`))
  const { entry } = word
  const handWritten = (entry.distractors ?? []).map(({ hr, en }) => ({ hr, en, label: '' }))
  const automatic = pickDistractors(entry, pool, random, 3 - handWritten.length, undefined, handWritten)
    .map(other => ({ hr: other.meaning.hr.trim(), en: other.meaning.en?.trim() || undefined, label: other.headword }))
  const correct = { hr: entry.meaning.hr.trim(), en: entry.meaning.en?.trim() || undefined, label: entry.headword }
  const usedEnglish = new Set<string>()
  const texts = [correct, ...handWritten, ...automatic].map((option, index) => {
    const key = (text: string) => text.toLocaleLowerCase('en')
    let en = option.en || option.hr
    if (usedEnglish.has(key(en))) en = option.hr
    if (usedEnglish.has(key(en))) en = `${en} (${option.label || index + 1})`
    usedEnglish.add(key(en))
    return { correct: index === 0, text: { hr: option.hr, ...(en === option.hr ? {} : { en }) } as DailyText }
  })
  const options = shuffled(texts, random).map((option, index) => ({ ...option, id: String.fromCharCode(97 + index) }))
  return {
    options: options.map(({ id, text }) => ({ id, text })),
    correctOptionId: options.find(option => option.correct)!.id
  }
}

function snapshotFor(word: Candidate, pool: readonly WordEntry[], day: string, village: string): Snapshot | null {
  const built = buildOptions(word, pool, day)
  // A word with nothing to choose between cannot be played; the caller tries another.
  if (built.options.length < 2) return null
  const areaIds = new Set(word.areas.map(area => area.id))
  const auto = villageAreaId(word.entry, word.areas)
  return {
    meaning: { hr: word.entry.meaning.hr, ...(word.entry.meaning.en ? { en: word.entry.meaning.en } : {}) },
    ...built,
    villageAreaId: village === 'none' ? null : village === 'auto' ? auto : areaIds.has(village) ? village : null,
    clues: buildClues(word.entry, built.options.length - 2)
  }
}

interface History {
  /** Words that may not be auto-picked while unused words remain. */
  used: Set<string>
  /** Words that may not be picked at all (future pins, this day's withdrawn words). */
  blocked: Set<string>
  /** Latest day each word was shown, for least-recently-used repetition. */
  lastUsed: Map<string, string>
}

function history(rows: readonly DailyRow[], day: string, today: DailyRow | null): History {
  const used = new Set<string>()
  const blocked = new Set<string>()
  const lastUsed = new Map<string, string>()
  const seen = (id: string, shownOn: string) => {
    if (shownOn < (lastUsed.get(id) ?? '')) return
    lastUsed.set(id, shownOn)
  }
  for (const row of rows) {
    for (const id of row.replaced_word_ids) used.add(id)
    if (row.day === day) continue
    used.add(row.word_id)
    if (row.day > day) blocked.add(row.word_id)
    else seen(row.word_id, row.day)
    for (const id of row.replaced_word_ids) if (row.day < day) seen(id, row.day)
  }
  // The word that just failed to play (withdrawn, or an unplayable pin) must not come back today.
  for (const id of [...(today?.replaced_word_ids ?? []), ...(today ? [today.word_id] : [])]) blocked.add(id)
  return { used, blocked, lastUsed }
}

/**
 * Tier A: unused, daily-ready. Tier B: unused, anything else. Tier C: everything has been
 * used, so repeat the least recently used word that is not pinned for the future.
 * Inside A and B, about one pick in seven is village-specific when both kinds exist.
 */
function pick(day: string, active: readonly Candidate[], past: History, share: number): Candidate[] {
  const byId = (a: Candidate, b: Candidate) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  const entries = active.map(word => word.entry)
  const pool = active.filter(word => !past.used.has(word.id) && !past.blocked.has(word.id))
  const ready = pool.filter(word => dailyReadiness(word.entry, entries).ready)
  const tier = ready.length ? ready : pool
  if (tier.length) {
    const random = seededRandom(hash(`heritage-daily:${day}`))
    const sorted = [...tier].sort(byId)
    const village = sorted.filter(word => villageAreaId(word.entry, word.areas))
    const region = sorted.filter(word => !villageAreaId(word.entry, word.areas))
    const wantVillage = random() < share
    const group = village.length && region.length ? (wantVillage ? village : region) : sorted
    const first = group[Math.floor(random() * group.length)]!
    // Ordered fallbacks, so an unplayable first choice does not fail the day.
    return [first, ...group.filter(word => word !== first), ...sorted.filter(word => !group.includes(word))]
  }
  // A word pinned for a future day or withdrawn today is never repeated early, even if that
  // leaves nothing to serve.
  const repeatable = active.filter(word => !past.blocked.has(word.id))
  return repeatable.sort((a, b) =>
    (past.lastUsed.get(a.id) ?? '').localeCompare(past.lastUsed.get(b.id) ?? '') || byId(a, b))
}

async function choose(client: SupabaseClient, day: string, rows: readonly DailyRow[], today: DailyRow | null, share: number) {
  const active = await activeCandidates(client)
  if (!active.length) throw new DailyWordError(404, 'no-words')
  const entries = active.map(word => word.entry)
  for (const word of pick(day, active, history(rows, day, today), share)) {
    const snapshot = snapshotFor(word, entries, day, 'auto')
    if (snapshot) return { word, snapshot }
  }
  throw new DailyWordError(404, 'no-words')
}

async function allRows(client: SupabaseClient) {
  return await pages<DailyRow>((from, to) => client.from(DAILY).select('*').order('day').range(from, to))
}

/** Reveals only the areas the entry points at, plus the parents needed to show them. */
function referencedAreas(entry: WordEntry, areas: readonly Area[], villageId: string | null) {
  const byId = new Map(areas.map(area => [area.id, area]))
  const wanted = new Set<string>()
  const add = (id: string | undefined) => {
    for (let area = id ? byId.get(id) : undefined; area && !wanted.has(area.id); area = area.parentId ? byId.get(area.parentId) : undefined) wanted.add(area.id)
  }
  usageAreaIds(entry).forEach(add)
  entry.examples?.forEach(example => add(example.areaId))
  add(villageId ?? undefined)
  return areas.filter(area => wanted.has(area.id))
}

function payload(row: DailyRow, word: Candidate, epoch: string): DailyWordPayload {
  const snapshot = row.snapshot
  const ids = snapshot?.options.map(option => option.id) ?? []
  if (!snapshot || ids.length < 2 || new Set(ids).size !== ids.length || !ids.includes(snapshot.correctOptionId)) {
    throw new Error(`[daily] Stored snapshot for ${row.day} is invalid`)
  }
  return {
    day: row.day,
    number: dayDiff(epoch, row.day) + 1,
    nextAt: zagrebMidnightUtc(addDays(row.day, 1)).toISOString(),
    sample: word.entry.status === 'placeholder',
    // Edits apply from the next day: the reveal must agree with the frozen correct option.
    entry: snapshot.meaning ? { ...word.entry, meaning: snapshot.meaning } : word.entry,
    areas: referencedAreas(word.entry, word.areas, snapshot.villageAreaId),
    villageAreaId: snapshot.villageAreaId,
    options: snapshot.options,
    correctOptionId: snapshot.correctOptionId,
    clues: snapshot.clues
  }
}

/**
 * Today's daily word. Safe to call concurrently from any number of requests or processes:
 * every writer computes the same pick from the same pool, the primary key admits one
 * insert, and every caller re-reads the winner's row.
 */
export async function resolveDailyWord(client: SupabaseClient, now = new Date(), options: DailyResolveOptions = {}): Promise<DailyWordPayload> {
  const epoch = options.epoch ?? DAILY_WORD_EPOCH
  const share = options.villageShare ?? DAILY_VILLAGE_SHARE
  const day = zagrebDay(now)
  if (day < epoch) throw new DailyWordError(404, 'not-started')
  const resolvedAt = now.toISOString()

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const row = await readRow(client, day)
    if (row?.resolved_at) {
      const word = await activeCandidate(client, row.word_id)
      if (word) return payload(row, word, epoch)
      // Withdrawn or deactivated since it was shown: consent and editorial removal win.
      const { word: next, snapshot } = await choose(client, day, await allRows(client), row, share)
      const { error } = await client.from(DAILY).update({
        word_id: next.id, source: 'auto', snapshot, resolved_at: resolvedAt, replaced_word_ids: [...row.replaced_word_ids, row.word_id]
      }).eq('day', day).eq('word_id', row.word_id)
      if (error) fail(error)
      continue
    }
    if (row) {
      const pinned = await activeCandidate(client, row.word_id)
      const snapshot = pinned && snapshotFor(pinned, (await activeCandidates(client)).map(word => word.entry), day, row.village)
      if (pinned && snapshot) {
        const { error } = await client.from(DAILY).update({ snapshot, resolved_at: resolvedAt })
          .eq('day', day).eq('word_id', row.word_id).is('resolved_at', null)
        if (error) fail(error)
        continue
      }
      console.warn(`[daily] Pinned word ${row.word_id} for ${day} is not playable; choosing another`)
      const { word: next, snapshot: chosen } = await choose(client, day, await allRows(client), row, share)
      const { error } = await client.from(DAILY).update({
        word_id: next.id, source: 'auto', snapshot: chosen, resolved_at: resolvedAt, replaced_word_ids: [...row.replaced_word_ids, row.word_id]
      }).eq('day', day).eq('word_id', row.word_id).is('resolved_at', null)
      if (error) fail(error)
      continue
    }
    const { word, snapshot } = await choose(client, day, await allRows(client), null, share)
    const { error } = await client.from(DAILY).upsert({
      day, word_id: word.id, source: 'auto', village: 'auto', snapshot, resolved_at: resolvedAt, replaced_word_ids: []
    }, { onConflict: 'day', ignoreDuplicates: true })
    if (error) fail(error)
  }
  throw new Error(`[daily] Could not settle the word for ${day}`)
}
