/** ASCII URL slug for atlas routes (report §4 transliteration rule). */
export function atlasSlug(value: string) {
  return value
    .toLocaleLowerCase('hr')
    .replaceAll('đ', 'dj')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function asciiId(value: string) {
  return atlasSlug(value).replace(/-/g, '-')
}

/** Normalise catalog ids that may contain diacritics. */
export function normalizeHeritageId(legacyId: string) {
  return legacyId
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'dj')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

export function isAsciiId(value: string) {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]+$/.test(value)
}
