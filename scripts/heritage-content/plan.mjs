// What the reviewed heritage content (data/heritage-content/churches.json) changes on one heritage item, given the
// item as the admin API returns it. Pure, so the rules are testable without a server.
//
// The import only adds, never overwrites an editor's work:
// - description, period and registry number are filled only while empty (a different stored value is kept and
//   reported);
// - the heritage status moves to "protected" only from no status or "needs verification";
// - research notes, sources and the photo are appended when they are not there yet.
// Running it twice therefore changes nothing the second time.

/** Free licences the import takes from Commons; `permission` is for photos given to the site, never imported. */
export const IMPORT_IMAGE_LICENSES = [
  'pd', 'cc0-1.0', 'cc-by-2.0', 'cc-by-2.5', 'cc-by-3.0', 'cc-by-4.0',
  'cc-by-sa-2.0', 'cc-by-sa-2.5', 'cc-by-sa-3.0', 'cc-by-sa-4.0'
]

/** Limits of the heritage item and source forms (shared/utils/content/heritageItem.ts, source.ts). */
export const LIMITS = { description: 20000, researchNotes: 5000, period: 200, registryNumber: 40, imagesPerItem: 6, sourceTitle: 500, url: 1000 }

const SOURCE_TYPES = ['official_registry', 'publication', 'website', 'municipal_source', 'other']
const KEY = /^[a-z0-9-]+\/[a-z0-9-]+$/
const SHA1 = /^[0-9a-f]{40}$/
const HTTP = /^https:\/\/\S+$/

/** Commons' machine-readable licence (extmetadata `License`) as the site's licence code, or null when not allowed. */
export function commonsLicense(code) {
  const value = String(code ?? '').toLowerCase()
  const known = value === 'cc0' ? 'cc0-1.0' : value
  return IMPORT_IMAGE_LICENSES.includes(known) ? known : null
}

/** Problems with the dataset itself; the import refuses to start while there are any. */
export function datasetIssues(dataset) {
  const issues = []
  const add = (where, message) => issues.push(`${where}: ${message}`)
  if (!dataset || typeof dataset !== 'object') return ['dataset: not an object']
  const sources = dataset.sources ?? {}
  for (const [key, source] of Object.entries(sources)) {
    if (!source.title || source.title.length > LIMITS.sourceTitle) add(`sources.${key}`, 'title missing or too long')
    if (!SOURCE_TYPES.includes(source.type)) add(`sources.${key}`, `type ${source.type} is not allowed`)
    if (!HTTP.test(source.url ?? '') || source.url.length > LIMITS.url) add(`sources.${key}`, 'url must be https and without spaces')
  }
  const urls = Object.values(sources).map(source => source.url)
  if (new Set(urls).size !== urls.length) add('sources', 'two sources share a url')
  const keys = new Set()
  for (const [index, item] of [...(dataset.items ?? []), ...(dataset.notesOnly ?? [])].entries()) {
    const where = item?.key ? `items.${item.key}` : `items.${index}`
    if (!KEY.test(item?.key ?? '')) add(where, 'key must be "<settlement slug>/<item slug>"')
    if (keys.has(item.key)) add(where, 'duplicate key')
    keys.add(item.key)
    if (!item.name) add(where, 'name missing')
    if (item.description != null && (typeof item.description !== 'string' || !item.description.trim() || item.description.length > LIMITS.description)) {
      add(where, 'description must be non-empty text within the limit')
    }
    if (item.period != null && (typeof item.period !== 'string' || item.period.length > LIMITS.period)) add(where, 'period too long')
    if (item.registryNumber != null && !/^(Z|P|RZG)-[0-9-]+$/.test(item.registryNumber)) add(where, `registry number ${item.registryNumber} has an unexpected form`)
    if (item.heritageStatus != null && item.heritageStatus !== 'protected') add(where, 'only "protected" is imported as a heritage status')
    for (const note of item.researchNotes ?? []) if (typeof note !== 'string' || !note.trim()) add(where, 'empty research note')
    for (const key of item.sources ?? []) if (!sources[key]) add(where, `unknown source ${key}`)
    const photo = item.photo
    if (photo) {
      if (!/^File:.+\.(jpe?g|JPE?G)$/.test(photo.commonsFile ?? '')) add(where, 'photo.commonsFile must be a Commons JPEG ("File:….jpg")')
      if (!SHA1.test(photo.sha1 ?? '')) add(where, 'photo.sha1 must be the 40-character sha1 of the reviewed file')
      if (!IMPORT_IMAGE_LICENSES.includes(photo.license)) add(where, `photo licence ${photo.license} is not a free licence the import takes`)
      if (!photo.alt?.trim()) add(where, 'photo.alt missing')
      if (!photo.author?.trim()) add(where, 'photo.author missing')
      if (!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:\S+$/.test(photo.sourceUrl ?? '')) add(where, 'photo.sourceUrl must be the Commons file page')
      if (photo.authorUrl != null && !HTTP.test(photo.authorUrl)) add(where, 'photo.authorUrl must be https')
    }
  }
  return issues
}

function textIncludes(text, note) {
  return (text ?? '').replace(/\s+/g, ' ').includes(note.replace(/\s+/g, ' ').trim())
}

/**
 * The PATCH body for one item (null when nothing changes), with what changes and what was kept.
 * `sourceIds` are the ids of the record's sources (resolved or about to be created); `image` is the uploaded
 * photo, or null when there is none to add.
 */
export function planItem(current, record, { sourceIds = [], image = null } = {}) {
  const patch = {}
  const changes = []
  const kept = []

  if (current.name !== record.name) kept.push(`name differs: stored "${current.name}", dataset "${record.name}" (stored name kept)`)

  for (const field of ['description', 'period', 'registryNumber']) {
    const wanted = record[field]
    if (wanted == null) continue
    const stored = current[field]
    if (!stored) {
      patch[field] = wanted
      changes.push(`${field}: set`)
    } else if (stored !== wanted) {
      kept.push(`${field}: stored value kept ("${String(stored).slice(0, 60)}${String(stored).length > 60 ? '…' : ''}")`)
    }
  }

  if (record.heritageStatus && current.heritageStatus !== record.heritageStatus) {
    if (current.heritageStatus == null || current.heritageStatus === 'needs_verification') {
      patch.heritageStatus = record.heritageStatus
      changes.push(`heritageStatus: ${current.heritageStatus ?? 'none'} → ${record.heritageStatus}`)
    } else {
      kept.push(`heritageStatus: stored "${current.heritageStatus}" kept`)
    }
  }

  const notes = (record.researchNotes ?? []).filter(note => !textIncludes(current.researchNotes, note))
  if (notes.length) {
    const merged = [current.researchNotes?.trim(), ...notes.map(note => note.trim())].filter(Boolean).join(' ')
    if (merged.length > LIMITS.researchNotes) {
      kept.push(`researchNotes: ${notes.length} note(s) not added, the notes would exceed ${LIMITS.researchNotes} characters`)
    } else {
      patch.researchNotes = merged
      changes.push(`researchNotes: +${notes.length}`)
    }
  }

  const storedSources = current.sourceIds ?? []
  const newSources = sourceIds.filter(id => !storedSources.includes(id))
  if (newSources.length) {
    patch.sourceIds = [...storedSources, ...newSources]
    changes.push(`sources: +${newSources.length}`)
  }

  if (image) {
    const storedImages = current.images ?? []
    if (storedImages.some(stored => stored.sourceUrl === image.sourceUrl)) {
      // Already there (an earlier run, or added by hand).
    } else if (storedImages.length >= LIMITS.imagesPerItem) {
      kept.push(`photo: not added, the item already has ${storedImages.length} photos`)
    } else {
      patch.images = [...storedImages, image]
      changes.push(storedImages.length ? 'photo: +1' : 'photo: +1 (main photo)')
    }
  }

  return { patch: changes.length ? { revision: current.revision, ...patch } : null, changes, kept }
}

/** True when the record still needs its photo on this item (so the import fetches and uploads it). */
export function needsPhoto(current, record) {
  const photo = record.photo
  if (!photo) return false
  const stored = current.images ?? []
  return stored.length < LIMITS.imagesPerItem && !stored.some(image => image.sourceUrl === photo.sourceUrl)
}

/** The image value saved on the item for an uploaded photo (the shape of HeritageImageValue). */
export function imageValue(photo, uploaded) {
  return {
    path: uploaded.path,
    thumbPath: uploaded.thumbPath,
    width: uploaded.width,
    height: uploaded.height,
    alt: photo.alt,
    caption: photo.caption ?? null,
    author: photo.author,
    authorUrl: photo.authorUrl ?? null,
    sourceUrl: photo.sourceUrl,
    license: photo.license
  }
}
