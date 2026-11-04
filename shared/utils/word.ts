import type { Area, WordEntry } from '../../app/types/heritage'
import { DAILY_CATEGORIES } from './dailyWord'

export interface WordInput {
  entry: WordEntry
  areas: Area[]
  active: boolean
}

export interface AdminWord extends WordInput {
  submissionId: number | null
  submissionPlace: string | null
  createdAt: string
  updatedAt: string
}

export type PublicWordEntry = WordEntry & { slug?: string }

export interface PublicWords {
  words: PublicWordEntry[]
  areas: Area[]
}

export const WORD_STATUSES = ['placeholder', 'community', 'verified'] as const
export const AREA_KINDS = ['settlement', 'municipality', 'town', 'county', 'region', 'country'] as const
export const SOURCE_KINDS = ['contribution', 'interview', 'publication', 'editor'] as const
export const NOTE_LIMIT = 1000
export const DISTRACTOR_LIMIT = 200
export const MAX_DISTRACTORS = 3
export const WORD_BODY_LIMIT = 128 * 1024
/** Display fallback for a variant without usages; never stored as data. */
export const REGION_FALLBACK_NAME = 'Potkalničko prigorje'

/** Also used to project public output: only explicitly parsed fields survive. */
export function validateWord(input: unknown, id: string): { value: WordInput, issues: string[] } {
  const issues: string[] = []
  function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return value as Record<string, unknown>
  }
  function text(value: unknown, path: string, max = 200, required = false): string {
    if (value === undefined && !required) return ''
    if (typeof value !== 'string') {
      issues.push(`${path}: očekuje se tekst`)
      return ''
    }
    const result = value.trim()
    if (result.length > max || (required && !result)) issues.push(`${path}: obavezno, najviše ${max} znakova`)
    return result
  }
  function list(value: unknown, path: string, max: number): unknown[] {
    if (value === undefined) return []
    if (!Array.isArray(value) || value.length > max) {
      issues.push(`${path}: najviše ${max} stavki`)
      return []
    }
    return value
  }
  function choice<T extends string>(value: unknown, values: readonly T[], path: string): T {
    if (!values.includes(value as T)) issues.push(`${path}: neispravna vrijednost`)
    return values.includes(value as T) ? value as T : values[0]!
  }
  function optional(value: unknown, path: string, max = 200) {
    return text(value, path, max) || undefined
  }
  function unique(values: string[], path: string) {
    if (new Set(values).size !== values.length) issues.push(`${path}: ID mora biti jedinstven`)
  }
  function same(a: string, b: string) {
    return a.normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase('hr') === b.normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase('hr')
  }
  const body = object(input)
  if (typeof body.active !== 'boolean') issues.push('active: očekuje se da/ne')
  const active = body.active === true
  const raw = object(body.entry)
  const meaning = object(raw.meaning)
  const areas: Area[] = list(body.areas, 'areas', 50).map((item, index) => {
    const a = object(item)
    const path = `areas.${index}`
    const centroid = a.centroid ? object(a.centroid) : null
    let coordinates: Area['centroid']
    if (centroid) {
      if (typeof centroid.lat !== 'number' || !Number.isFinite(centroid.lat) || Math.abs(centroid.lat) > 90
        || typeof centroid.lng !== 'number' || !Number.isFinite(centroid.lng) || Math.abs(centroid.lng) > 180) {
        issues.push(`${path}.centroid: neispravne koordinate`)
      } else coordinates = { lat: centroid.lat, lng: centroid.lng }
    }
    const externalIds: Record<string, string> = {}
    const external = object(a.externalIds)
    if (Object.keys(external).length > 10) issues.push(`${path}.externalIds: najviše 10 stavki`)
    for (const [key, value] of Object.entries(external).slice(0, 10)) {
      externalIds[text(key, `${path}.externalIds.key`, 100, true)] = text(value, `${path}.externalIds`, 200, true)
    }
    return {
      id: text(a.id, `${path}.id`, 200, true),
      name: text(a.name, `${path}.name`, 200, true),
      kind: choice(a.kind, AREA_KINDS, `${path}.kind`),
      parentId: a.parentId === null ? null : text(a.parentId, `${path}.parentId`, 200) || null,
      alsoIn: list(a.alsoIn, `${path}.alsoIn`, 10).map(v => text(v, `${path}.alsoIn`, 200, true)),
      centroid: coordinates,
      boundaryRef: optional(a.boundaryRef, `${path}.boundaryRef`),
      externalIds
    }
  })
  unique(areas.map(a => a.id), 'areas')
  const areaIds = new Set(areas.map(a => a.id))
  function areaRef(value: string | undefined, path: string) {
    if (value && !areaIds.has(value)) issues.push(`${path}: nepoznato područje`)
  }
  for (const area of areas) {
    areaRef(area.parentId ?? undefined, 'areas.parentId')
    area.alsoIn?.forEach(id => areaRef(id, 'areas.alsoIn'))
    const visited = new Set<string>([area.id])
    let parent = area.parentId
    while (parent) {
      if (visited.has(parent)) {
        issues.push('areas: kružna hijerarhija')
        break
      }
      visited.add(parent)
      parent = areas.find(a => a.id === parent)?.parentId ?? null
    }
  }
  const entry: WordEntry = {
    id,
    headword: text(raw.headword, 'headword', 200, active),
    meaning: { hr: text(meaning.hr, 'meaning.hr', 2000, active), en: optional(meaning.en, 'meaning.en', 2000) },
    partOfSpeech: text(raw.partOfSpeech, 'partOfSpeech', 100, active),
    status: choice(raw.status, WORD_STATUSES, 'status'),
    examples: list(raw.examples, 'examples', 20).map((item, index) => {
      const e = object(item)
      const areaId = optional(e.areaId, `examples.${index}.areaId`)
      areaRef(areaId, 'examples.areaId')
      return { text: text(e.text, `examples.${index}.text`, 2000, true), translation: optional(e.translation, `examples.${index}.translation`, 2000), areaId }
    }),
    sources: list(raw.sources, 'sources', 20).map((item, index) => {
      const s = object(item)
      return { id: text(s.id, `sources.${index}.id`, 200, true), kind: choice(s.kind, SOURCE_KINDS, `sources.${index}.kind`), credit: optional(s.credit, `sources.${index}.credit`, 300) }
    }),
    tags: list(raw.tags, 'tags', 20).map(v => text(v, 'tags', 100, true)),
    variants: list(raw.variants, 'variants', 30).map((item, index) => {
      const v = object(item)
      const audio = optional(v.audio, `variants.${index}.audio`, 1000)
      if (audio && !/^https:\/\/[^\s]+$/.test(audio)) issues.push(`variants.${index}.audio: očekuje se HTTPS URL`)
      return {
        id: text(v.id, `variants.${index}.id`, 200, true),
        form: text(v.form, `variants.${index}.form`, 200, active),
        status: choice(v.status, WORD_STATUSES, `variants.${index}.status`),
        pronunciation: optional(v.pronunciation, `variants.${index}.pronunciation`),
        audio,
        usages: list(v.usages, `variants.${index}.usages`, 30).map((item, usageIndex) => {
          const u = object(item)
          const path = `variants.${index}.usages.${usageIndex}`
          const areaId = text(u.areaId, `${path}.areaId`, 200, true)
          areaRef(areaId, `${path}.areaId`)
          return { areaId, confidence: choice(u.confidence, ['reported', 'confirmed'], `${path}.confidence`), sourceId: optional(u.sourceId, `${path}.sourceId`), note: optional(u.note, `${path}.note`, 500) }
        })
      }
    })
  }
  if (raw.category !== undefined && raw.category !== null && raw.category !== '') {
    if (DAILY_CATEGORIES.includes(raw.category as typeof DAILY_CATEGORIES[number])) entry.category = raw.category as typeof DAILY_CATEGORIES[number]
    else issues.push('category: neispravna vrijednost')
  }
  if (raw.note !== undefined && raw.note !== null) {
    const note = object(raw.note)
    const noteHr = text(note.hr, 'note.hr', NOTE_LIMIT)
    const noteEn = optional(note.en, 'note.en', NOTE_LIMIT)
    if (noteEn && !noteHr) issues.push('note.hr: obavezno uz engleski tekst')
    if (noteHr) entry.note = { hr: noteHr, en: noteEn }
  }
  const handWritten = list(raw.distractors, 'distractors', MAX_DISTRACTORS)
  if (handWritten.length) {
    const distractors: NonNullable<WordEntry['distractors']> = handWritten.map((item, index) => {
      const d = object(item)
      return { hr: text(d.hr, `distractors.${index}.hr`, DISTRACTOR_LIMIT, true), en: optional(d.en, `distractors.${index}.en`, DISTRACTOR_LIMIT) }
    })
    const forbiddenMeanings = [entry.meaning.hr, entry.meaning.en].filter((t): t is string => !!t?.trim())
    const seen = new Set<string>()
    distractors.forEach((d, index) => {
      if (!d.hr) return
      const fields: { path: 'hr' | 'en', value: string }[] = [{ path: 'hr', value: d.hr }]
      if (d.en) fields.push({ path: 'en', value: d.en })
      for (const { path, value } of fields) {
        if (forbiddenMeanings.some(meaning => same(value, meaning))) issues.push(`distractors.${index}.${path}: ne smije biti jednako značenju`)
        else if ([...seen].some(other => same(other, value))) issues.push(`distractors.${index}.${path}: mora se razlikovati od ostalih`)
        else seen.add(value)
      }
    })
    entry.distractors = distractors
  }
  unique(entry.sources.map(s => s.id), 'sources')
  unique(entry.variants.map(v => v.id), 'variants')
  for (const variant of entry.variants) {
    unique(variant.usages.map(u => u.areaId), 'usages')
    for (const usage of variant.usages) {
      if (usage.sourceId && !entry.sources.some(s => s.id === usage.sourceId)) issues.push('usages.sourceId: nepoznat izvor')
    }
  }
  if (active && (!entry.variants.length || entry.variants[0]?.form !== entry.headword)) issues.push('variants: prva inačica mora biti naslovna riječ')
  if (active && !entry.sources.length) issues.push('sources: navedi izvor prije aktivacije')
  return { value: { entry, areas, active }, issues }
}
