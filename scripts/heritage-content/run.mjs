// Runs the heritage content import against a live site through its admin API (the same routes the admin screen
// uses), authenticated with the review secret as a Bearer token. Dry run by default: it reads the items, the
// sources and the Commons file pages and reports what it would change; only `apply` creates sources, uploads
// photos and saves items. `fetchImpl` is injectable so the whole run can be exercised without a network.
import { commonsLicense, datasetIssues, imageValue, needsPhoto, planItem } from './plan.mjs'

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const USER_AGENT = 'PotkalnickiZapisiImport/1.0 (heritage content import; https://prigorje.karlo-siladi.from.hr)'
/** The long side of the copies made from a Commons file, as the admin screen makes them (app/utils/imageResize.ts). */
export const PHOTO_SIDES = { large: 1600, thumb: 480 }
/** The upload endpoint's per-file cap (server/utils/heritageImages.ts). */
const FILE_MAX_BYTES = 1_500_000
const PAGE_SIZE = 100

export class ImportError extends Error {}

function client(base, secret, fetchImpl) {
  const root = base.replace(/\/+$/, '')
  return async function api(method, path, body) {
    const response = await fetchImpl(root + path, {
      method,
      headers: {
        authorization: `Bearer ${secret}`,
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' })
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    const text = await response.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch { /* an HTML error page */ }
    if (!response.ok) {
      const detail = data?.data?.issues?.map(issue => `${issue.path}: ${issue.message}`).join('; ') || data?.data?.message || data?.statusMessage || text.slice(0, 200)
      throw new ImportError(`${method} ${path} → ${response.status} ${detail}`)
    }
    return data
  }
}

async function listAll(api, kind) {
  const rows = []
  for (let page = 1; ; page += 1) {
    const result = await api('GET', `/api/admin/content/${kind}?size=${PAGE_SIZE}&page=${page}`)
    rows.push(...result.rows)
    if (result.rows.length < PAGE_SIZE || rows.length >= result.total) return rows
  }
}

async function commonsInfo(fetchImpl, file, side) {
  const query = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', titles: file, prop: 'imageinfo',
    iiprop: 'sha1|size|mime|url|extmetadata', iiurlwidth: String(side), iiurlheight: String(side)
  })
  const response = await fetchImpl(`${COMMONS_API}?${query}`, { headers: { 'user-agent': USER_AGENT, 'accept': 'application/json' } })
  if (!response.ok) throw new ImportError(`Commons ${file} → ${response.status}`)
  const page = (await response.json()).query?.pages?.[0]
  const info = page?.imageinfo?.[0]
  if (!info) throw new ImportError(`Commons ${file}: file not found`)
  return info
}

async function download(fetchImpl, url) {
  const response = await fetchImpl(url, { headers: { 'user-agent': USER_AGENT } })
  if (!response.ok) throw new ImportError(`download ${url} → ${response.status}`)
  const type = response.headers.get('content-type') ?? ''
  if (!type.startsWith('image/jpeg')) throw new ImportError(`download ${url}: expected a JPEG, got ${type || 'no type'}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > FILE_MAX_BYTES) throw new ImportError(`download ${url}: ${bytes.length} bytes is over the upload cap`)
  return bytes.toString('base64')
}

/**
 * Checks a reviewed photo against Commons as it is now: the same file version (sha1) and the same free licence.
 * A file that changed after review is refused rather than published unseen.
 */
async function checkPhoto(fetchImpl, photo) {
  const large = await commonsInfo(fetchImpl, photo.commonsFile, PHOTO_SIDES.large)
  if (large.sha1 !== photo.sha1) throw new ImportError(`${photo.commonsFile}: the file changed on Commons since review (sha1 ${large.sha1})`)
  const license = String(large.extmetadata?.License?.value ?? '').toLowerCase()
  if (commonsLicense(license) !== photo.license) throw new ImportError(`${photo.commonsFile}: licence on Commons is now "${license}", reviewed "${photo.license}"`)
  if (large.mime !== 'image/jpeg') throw new ImportError(`${photo.commonsFile}: not a JPEG (${large.mime})`)
  return large
}

async function uploadPhoto(api, fetchImpl, photo, large) {
  const thumb = await commonsInfo(fetchImpl, photo.commonsFile, PHOTO_SIDES.thumb)
  const body = { image: await download(fetchImpl, large.thumburl), thumb: await download(fetchImpl, thumb.thumburl) }
  return api('POST', '/api/admin/images', body)
}

/**
 * Imports `dataset` into the site at `base`. Returns a report per item; throws only for problems that stop the
 * whole run (an invalid dataset, a refused secret, an unreachable site).
 */
export async function runImport({ dataset, base, secret, apply = false, only = null, fetchImpl = fetch, log = () => {} }) {
  const issues = datasetIssues(dataset)
  if (issues.length) throw new ImportError(`The dataset has problems:\n- ${issues.join('\n- ')}`)
  if (!secret) throw new ImportError('NUXT_REVIEW_SECRET is not set.')
  const api = client(base, secret, fetchImpl)
  const mode = apply ? 'apply' : 'dry run'
  log(`Heritage content import (${mode}) against ${base}`)

  const items = await listAll(api, 'heritage_item')
  const byKey = new Map(items.map(item => [`${item.settlementSlug ?? '-'}/${item.slug}`, item]))
  const sources = await listAll(api, 'source')
  const sourceByUrl = new Map(sources.map(source => [source.url, source]))

  const records = [...(dataset.items ?? []), ...(dataset.notesOnly ?? [])].filter(record => !only || record.key === only)
  if (only && !records.length) throw new ImportError(`No dataset item has the key ${only}.`)

  // Sources first: an item can only cite a source that exists.
  const sourceIds = new Map()
  const createdSources = []
  for (const key of new Set(records.flatMap(record => record.sources ?? []))) {
    const wanted = dataset.sources[key]
    const found = sourceByUrl.get(wanted.url)
    if (found) {
      sourceIds.set(key, found.id)
    } else if (apply) {
      const { entity } = await api('POST', '/api/admin/content/source', { ...wanted, status: 'published' })
      sourceIds.set(key, entity.id)
      createdSources.push(key)
      log(`  source created: ${wanted.title}`)
    } else {
      sourceIds.set(key, `(new: ${key})`)
      createdSources.push(key)
    }
  }

  const report = []
  for (const record of records) {
    const entry = { key: record.key, name: record.name, status: 'unchanged', changes: [], kept: [], problems: [] }
    report.push(entry)
    const listed = byKey.get(record.key)
    if (!listed) {
      entry.status = 'not found'
      entry.problems.push('no heritage item at this settlement/slug; skipped')
      continue
    }
    const { entity: current } = await api('GET', `/api/admin/content/heritage_item/${listed.id}`)

    let image = null
    if (needsPhoto(current, record)) {
      try {
        const large = await checkPhoto(fetchImpl, record.photo)
        image = apply
          ? imageValue(record.photo, await uploadPhoto(api, fetchImpl, record.photo, large))
          : imageValue(record.photo, { path: '(upload)', thumbPath: '(upload)', width: large.thumbwidth, height: large.thumbheight })
      } catch (error) {
        if (!(error instanceof ImportError)) throw error
        entry.problems.push(`photo not added: ${error.message}`)
      }
    }

    const plan = planItem(current, record, { sourceIds: (record.sources ?? []).map(key => sourceIds.get(key)), image })
    entry.changes = plan.changes
    entry.kept = plan.kept
    if (!plan.patch) continue
    if (apply) {
      try {
        await api('PATCH', `/api/admin/content/heritage_item/${current.id}`, plan.patch)
        entry.status = 'updated'
      } catch (error) {
        if (!(error instanceof ImportError)) throw error
        entry.status = 'failed'
        entry.problems.push(error.message)
      }
    } else {
      entry.status = 'would update'
    }
  }

  for (const entry of report) {
    log(`- ${entry.key} (${entry.name}): ${entry.status}${entry.changes.length ? ` — ${entry.changes.join(', ')}` : ''}`)
    for (const line of entry.kept) log(`    kept: ${line}`)
    for (const line of entry.problems) log(`    problem: ${line}`)
  }
  const count = status => report.filter(entry => entry.status === status).length
  log(apply
    ? `Done: ${count('updated')} updated, ${count('unchanged')} unchanged, ${count('failed')} failed, ${count('not found')} not found; ${createdSources.length} source(s) created.`
    : `Dry run: ${count('would update')} would update, ${count('unchanged')} unchanged, ${count('not found')} not found; ${createdSources.length} source(s) would be created. Nothing was written. Run again with --apply to import.`)
  return { report, createdSources }
}
