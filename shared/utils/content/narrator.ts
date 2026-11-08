import type { ContentEntity, ContentStatus, ContentValidation } from './common'
import { contentFold, contentStatus, isRecord, issueCollector } from './common'
import { HERITAGE_VERIFICATIONS, type HeritageVerification } from './heritageItem'
import { INTANGIBLE_LIMITS, checkSlug, parseOptionalId } from './intangible'
import { atlasSlug } from '../atlasSlug'

// A Narrator (Kazivač): who told, said, sang or described a Story, Custom or Folk text, and, as a collector, who wrote
// it down. A record of its own, not a Person (GLOSSARY.md, "Narrator"; docs/adr/0001). The public sees the name only
// when an editor has recorded consent to publish it; otherwise they see the anonymous public description. The
// database repeats the rules (supabase/migrations/20261108000000_intangible_heritage.sql).

export const NARRATOR_LIMITS = {
  name: 200,
  publicDescription: 300,
  consentNote: 500
} as const

const YEAR_MIN = 1000
const YEAR_MAX = 2100

export interface NarratorValue {
  /** The real name: for editors, and public only with `consentNamed`. */
  name: string
  slug: string
  /** What the public sees instead of the name: "kazivačica, r. 1938., Gornji Fodrovec". */
  publicDescription: string | null
  /** An editor has recorded that this narrator agreed to be named in public. */
  consentNamed: boolean
  /** How and when the consent was given. Editors only, never public. */
  consentNote: string | null
  living: boolean
  bornYear: number | null
  /** The home settlement (Mjesto življenja): an area of kind settlement. */
  settlementId: string | null
  /** A narrator who is also a notable historical Person. */
  personId: string | null
  verification: HeritageVerification
  /** The private note. */
  researchNotes: string
  noindex: boolean
  status: ContentStatus
}

export type Narrator = ContentEntity & NarratorValue & {
  settlementLabel?: string | null
  personLabel?: string | null
}

/** Whether `text` repeats a word of `name` that is long enough to identify a person (three letters or more). */
export function containsNamePart(text: string, name: string) {
  const folded = contentFold(text)
  return contentFold(name).split(/\s+/).filter(part => part.length >= 3).some(part => folded.includes(part))
}

/** Validates and projects a narrator for the admin API. */
export function validateNarrator(input: unknown): ContentValidation<NarratorValue> {
  const check = issueCollector()
  const body = isRecord(input) ? input : {}
  if (!isRecord(input)) check.add('', 'Podaci kazivača nedostaju.')

  const name = check.required('name', body.name, NARRATOR_LIMITS.name, 'Ime')
  const publicDescription = check.optional('publicDescription', body.publicDescription, NARRATOR_LIMITS.publicDescription, 'Javni opis')
  const consentNote = check.optional('consentNote', body.consentNote, NARRATOR_LIMITS.consentNote, 'Bilješka o pristanku')
  if (body.consentNamed !== undefined && typeof body.consentNamed !== 'boolean') check.add('consentNamed', 'Pristanak mora biti da ili ne.')
  const consentNamed = body.consentNamed === true
  if (!consentNamed && !publicDescription) {
    check.add('publicDescription', 'Kazivač bez pristanka za javno navođenje imena treba javni opis, npr. „kazivačica, r. 1938., Gornji Fodrovec“.')
  }

  // The slug is public (the narrator's page address), so without consent it comes from the public description and
  // must not repeat the name; the same goes for the description itself.
  const slug = checkSlug(check.add, body.slug, () => {
    const source = consentNamed ? name : publicDescription
    return source ? atlasSlug(source) : ''
  })
  if (name && !consentNamed) {
    if (slug && containsNamePart(slug.replaceAll('-', ' '), name)) check.add('slug', 'Slug ne smije sadržavati ime kazivača bez pristanka za javno navođenje.')
    if (publicDescription && containsNamePart(publicDescription, name)) check.add('publicDescription', 'Javni opis ne smije sadržavati ime kazivača bez pristanka za javno navođenje.')
  }

  if (body.living !== undefined && typeof body.living !== 'boolean') check.add('living', 'Polje „Živ/a“ mora biti da ili ne.')
  const living = body.living !== false

  let bornYear: number | null = null
  if (body.bornYear !== undefined && body.bornYear !== null && body.bornYear !== '') {
    if (typeof body.bornYear !== 'number' || !Number.isSafeInteger(body.bornYear) || body.bornYear < YEAR_MIN || body.bornYear > YEAR_MAX) {
      check.add('bornYear', `Godina rođenja mora biti cijeli broj između ${YEAR_MIN} i ${YEAR_MAX}.`)
    } else bornYear = body.bornYear
  }

  const value: NarratorValue = {
    name,
    slug,
    publicDescription,
    consentNamed,
    consentNote,
    living,
    bornYear,
    settlementId: parseOptionalId(check.add, 'settlementId', body.settlementId, 'Mjesto življenja'),
    personId: parseOptionalId(check.add, 'personId', body.personId, 'Osoba'),
    verification: body.verification === undefined ? 'unverified' : check.oneOf('verification', body.verification, HERITAGE_VERIFICATIONS, 'Status provjere'),
    researchNotes: check.optional('researchNotes', body.researchNotes, INTANGIBLE_LIMITS.researchNotes, 'Bilješka') ?? '',
    noindex: body.noindex === true,
    status: contentStatus(body.status, 'draft', check.add)
  }
  return { value, issues: check.issues }
}
