import type { PublicPerson } from '../types/publicAtlas'

/**
 * An ISO date for a display date that is exact: "14. 1. 1813." (day) or "1813." (year). Approximate or
 * uncertain dates ("oko 1588.", "1405. ili 1408.") give undefined, so structured data never claims more
 * than the record does.
 */
export function exactIsoDate(text: string | null | undefined): string | undefined {
  const value = (text ?? '').trim()
  const full = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?$/.exec(value)
  if (full) {
    const [day, month, year] = [Number(full[1]), Number(full[2]), full[3]!]
    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  return /^\d{4}\.?$/.test(value) ? value.slice(0, 4) : undefined
}

/** schema.org Person for a person page: dates only when exact, `sameAs` from the source URLs. */
export function personJsonLd(person: PublicPerson, url: string) {
  const birthDate = exactIsoDate(person.born)
  const deathDate = exactIsoDate(person.died)
  const sameAs = person.sources.flatMap(source => source.url ? [source.url] : [])
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    'name': person.name,
    url,
    ...(person.role && { description: person.role }),
    ...(birthDate && { birthDate }),
    ...(deathDate && { deathDate }),
    ...(sameAs.length && { sameAs })
  }
}
