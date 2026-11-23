import { randomUUID } from 'node:crypto'
import { crc32 } from 'node:zlib'
import sharp from 'sharp'
import { SUBMISSION_LIMITS, PRIVACY_NOTICE_VERSION, type SubmissionLocale } from '../../shared/utils/submission'
import type { SubmissionPhotoInput } from '../../shared/utils/submissionPhoto'
import { SUBMISSION_PHOTO_BUCKET, SUBMISSION_PHOTO_LIMITS } from '../../shared/utils/submissionPhoto'
import { databaseError, useDatabaseClient } from './db'
import { fail } from './content/store'
import type { ResolvedSubmissionInput } from './submissions'
import { withSubmissionLock } from './submissionLifecycle'
import { placeSnapshot, resolveContributionPlace, PLACE_CATALOG_VERSION } from './places'

export const SUBMISSION_PHOTO_BODY_LIMIT = 55_000_000

export type ContributorImageType = 'jpeg' | 'png'

export interface ContributorImageInfo {
  type: ContributorImageType
  width: number
  height: number
}

/** JPEG or PNG only; WebP is refused so contributors send what the design promises. */
export async function contributorImageInfo(bytes: Uint8Array): Promise<ContributorImageInfo | null> {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)
  if (!png && !(bytes[0] === 0xff && bytes[1] === 0xd8)) return null
  if (png && !Buffer.from(bytes.subarray(-12)).equals(Buffer.from('0000000049454e44ae426082', 'hex'))) return null
  if (png) {
    const data = Buffer.from(bytes)
    let at = 8
    while (at + 12 <= data.length) {
      const end = at + 12 + data.readUInt32BE(at)
      if (end > data.length || crc32(data.subarray(at + 4, end - 4)) !== data.readUInt32BE(end - 4)) return null
      at = end
    }
    if (at !== data.length) return null
  }
  try {
    const image = sharp(bytes, { failOn: 'warning' })
    const { format, width, height } = await image.metadata()
    if ((format !== 'jpeg' && format !== 'png') || !width || !height) return null
    await image.stats()
    return { type: format, width, height }
  } catch {
    return null
  }
}

export interface CheckedPhotoFile {
  bytes: Buffer
  info: ContributorImageInfo
  fileName: string
}

export interface PhotoSubmissionMeta {
  locale: SubmissionLocale
  name: string | null
  contact: string | null
  consentPublish: boolean
  placeId: string | null
  photos: SubmissionPhotoInput[]
}

export interface PhotoUploadIssue {
  path: string
  message: string
}

function trimField(value: unknown, min: number, max: number, label: string): string | PhotoUploadIssue {
  if (typeof value !== 'string' || !value.trim()) return { path: label, message: `${label}: obavezno polje.` }
  const trimmed = value.trim()
  if (trimmed.length < min || trimmed.length > max) return { path: label, message: `${label}: nevaljana duljina.` }
  return trimmed
}

function parseMetaJson(raw: string) {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

export function parsePhotoSubmissionMeta(raw: unknown): { ok: true, value: PhotoSubmissionMeta } | { ok: false, issues: PhotoUploadIssue[] } {
  const parsed = typeof raw === 'string'
    ? parseMetaJson(raw)
    : (raw && typeof raw === 'object' ? raw as Record<string, unknown> : null)
  const issues: PhotoUploadIssue[] = []
  if (!parsed) return { ok: false, issues: [{ path: 'meta', message: 'Podaci obrasca nisu valjani.' }] }
  const body = parsed

  const locale = body.locale === 'hr' || body.locale === 'en' ? body.locale : null
  if (!locale) issues.push({ path: 'locale', message: 'Jezik nije valjan.' })
  if (body.consentPublish !== true) issues.push({ path: 'consentPublish', message: 'Označi pristanak za objavu.' })

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, SUBMISSION_LIMITS.name.max) || null : null
  const contact = typeof body.contact === 'string' ? body.contact.trim().slice(0, SUBMISSION_LIMITS.contact.max) || null : null
  let placeId: string | null = null
  if (body.placeId !== undefined && body.placeId !== null && body.placeId !== '') {
    if (typeof body.placeId === 'string' && /^geonames:[0-9]{1,10}$/.test(body.placeId)) placeId = body.placeId
    else issues.push({ path: 'placeId', message: 'Odaberi naselje s popisa.' })
  }

  const photosRaw = Array.isArray(body.photos) ? body.photos : null
  if (!photosRaw?.length) issues.push({ path: 'photos', message: 'Dodaj barem jednu fotografiju.' })
  else if (photosRaw.length > SUBMISSION_PHOTO_LIMITS.perSubmission) {
    issues.push({ path: 'photos', message: 'Najviše 5 fotografija.' })
  }

  const photos: SubmissionPhotoInput[] = []
  if (photosRaw) {
    photosRaw.forEach((entry, index) => {
      const row = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
      const alt = trimField(row.alt, SUBMISSION_PHOTO_LIMITS.alt.min, SUBMISSION_PHOTO_LIMITS.alt.max, `photos[${index}].alt`)
      if (typeof alt !== 'string') issues.push(alt)
      const author = trimField(row.author, SUBMISSION_PHOTO_LIMITS.author.min, SUBMISSION_PHOTO_LIMITS.author.max, `photos[${index}].author`)
      if (typeof author !== 'string') issues.push(author)
      if (row.publishPermission !== true) issues.push({ path: `photos[${index}].publishPermission`, message: 'Označi smijemo li objaviti fotografiju.' })
      if (typeof alt === 'string' && typeof author === 'string' && row.publishPermission === true) {
        photos.push({ alt, author, publishPermission: true })
      }
    })
  }

  if (issues.length || !locale) return { ok: false, issues }
  return { ok: true, value: { locale, name, contact, consentPublish: true, placeId, photos } }
}

export async function matchPhotoFiles(parts: Array<{ name?: string, data?: Uint8Array, filename?: string }>, expected: number): Promise<{ files: CheckedPhotoFile[], issues: PhotoUploadIssue[] }> {
  const issues: PhotoUploadIssue[] = []
  const files: CheckedPhotoFile[] = []
  for (let index = 0; index < expected; index++) {
    const part = parts.find(entry => entry.name === `photo-${index}`)
    if (!part?.data?.length) {
      issues.push({ path: `photo-${index}`, message: 'Fotografija nedostaje.' })
      continue
    }
    if (part.data.length > SUBMISSION_PHOTO_LIMITS.maxBytes) {
      issues.push({ path: `photo-${index}`, message: 'Datoteka je prevelika. Najviše 10 MB, u obliku JPG ili PNG.' })
      continue
    }
    const info = await contributorImageInfo(part.data)
    if (!info) {
      issues.push({ path: `photo-${index}`, message: 'Datoteka je prevelika. Najviše 10 MB, u obliku JPG ili PNG.' })
      continue
    }
    const fileName = typeof part.filename === 'string' ? part.filename : `photo-${index}`
    files.push({ bytes: Buffer.from(part.data), info, fileName })
  }
  if (files.length !== expected) return { files: [], issues: issues.length ? issues : [{ path: 'photos', message: 'Fotografije nisu u skladu s metapodacima.' }] }
  return { files, issues: [] }
}

export async function removeSubmissionPhotoObjects(paths: string[]) {
  if (!paths.length) return
  const bucket = useDatabaseClient().storage.from(SUBMISSION_PHOTO_BUCKET)
  let message = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { error } = await bucket.remove(paths)
      if (!error) return
      message = error.message
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
  }
  console.error('[submission-photos] Storage removal failed:', message)
  fail(502, 'Storage error', { message: 'Brisanje fotografija nije uspjelo.' })
}

export async function deleteSubmissionData(id: number, additionalPaths: string[] = []) {
  const photos = await listSubmissionPhotos(id)
  await removeSubmissionPhotoObjects([...new Set([...photos.map(photo => photo.path), ...additionalPaths])])
  const { data, error } = await useDatabaseClient().rpc('delete_heritage_submission', { p_id: id, p_paths: photos.map(photo => photo.path) })
  if (error) databaseError(error)
  return data === true
}

export async function insertPhotoSubmission(accountId: string, meta: PhotoSubmissionMeta, files: CheckedPhotoFile[]) {
  const selected = meta.placeId ? resolveContributionPlace(meta.placeId) : null
  if (meta.placeId && !selected) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid submission', data: { issues: [{ path: 'placeId', message: 'Odaberi naselje s popisa.' }] } })
  }
  const summary = meta.photos.map(photo => photo.alt).join('; ').slice(0, SUBMISSION_LIMITS.text.max)
  const text = summary.length >= SUBMISSION_LIMITS.text.min ? summary : `${summary}.`
  const input: ResolvedSubmissionInput = {
    text,
    type: 'photo',
    targetKind: null,
    targetId: null,
    payload: null,
    baseRevision: null,
    placeId: meta.placeId,
    wordId: null,
    intent: null,
    name: meta.name,
    contact: meta.contact,
    consentPublish: true,
    locale: meta.locale,
    place: selected ? placeSnapshot(selected) : null,
    placeCatalogVersion: selected ? PLACE_CATALOG_VERSION : null
  }
  const db = useDatabaseClient()
  const { data, error } = await db.from('heritage_submissions').insert({
    text: input.text,
    type: input.type,
    place: input.place,
    place_id: input.placeId,
    place_catalog_version: input.placeCatalogVersion,
    name: input.name,
    contact: input.contact,
    consent_publish: true,
    consent_version: PRIVACY_NOTICE_VERSION,
    locale: input.locale
  }).select('id').single()
  if (error) databaseError(error)
  const submissionId = Number(data.id)
  return withSubmissionLock(submissionId, async () => {
    const paths: string[] = []
    try {
      const rows = files.map((file, position) => ({
        id: randomUUID(),
        submission_id: submissionId,
        account_id: accountId,
        position,
        path: `submissions/${randomUUID()}.${file.info.type === 'png' ? 'png' : 'jpg'}`,
        width: file.info.width,
        height: file.info.height,
        byte_size: file.bytes.length,
        alt: meta.photos[position]!.alt,
        author: meta.photos[position]!.author,
        publish_permission: meta.photos[position]!.publishPermission
      }))
      const { error: rowError } = await db.from('heritage_submission_photos').insert(rows)
      if (rowError) databaseError(rowError)
      async function assertTracked() {
        const { data: current, error: readError } = await db.from('heritage_submissions')
          .select('id, heritage_submission_photos(id, path)')
          .eq('id', submissionId)
          .maybeSingle()
        if (readError) databaseError(readError)
        const tracked = current?.heritage_submission_photos ?? []
        if (!current || tracked.length !== rows.length || rows.some(row => !tracked.some((photo: { id: string, path: string }) => photo.id === row.id && photo.path === row.path))) {
          fail(409, 'Submission removed', { message: 'Prilog je u međuvremenu obrisan. Fotografije nisu poslane.' })
        }
      }
      await assertTracked()
      for (let position = 0; position < files.length; position++) {
        const file = files[position]!
        const path = rows[position]!.path
        paths.push(path)
        const { error: uploadError } = await db.storage.from(SUBMISSION_PHOTO_BUCKET).upload(path, file.bytes, {
          contentType: file.info.type === 'png' ? 'image/png' : 'image/jpeg',
          cacheControl: '86400',
          upsert: false
        })
        if (uploadError) {
          console.error('[submission-photos] Storage upload failed:', uploadError.message)
          fail(502, 'Storage error', { message: 'Spremanje fotografije nije uspjelo.' })
        }
        await assertTracked()
      }
    } catch (error) {
      await deleteSubmissionData(submissionId, paths)
      throw error
    }
    return submissionId
  })
}

export interface SubmissionPhotoRow {
  id: string
  position: number
  alt: string
  author: string
  publish_permission: boolean
  path: string
  width: number
  height: number
  byte_size: number
}

export async function listSubmissionPhotos(submissionId: number) {
  const { data, error } = await useDatabaseClient()
    .from('heritage_submission_photos')
    .select('id, position, alt, author, publish_permission, path, width, height, byte_size')
    .eq('submission_id', submissionId)
    .order('position', { ascending: true })
  if (error) databaseError(error)
  return (data ?? []) as SubmissionPhotoRow[]
}

export async function signedSubmissionPhotoUrls(paths: string[], expiresIn = 3600) {
  const bucket = useDatabaseClient().storage.from(SUBMISSION_PHOTO_BUCKET)
  const urls = new Map<string, string>()
  for (const path of paths) {
    const { data, error } = await bucket.createSignedUrl(path, expiresIn)
    if (error || !data?.signedUrl) {
      console.error('[submission-photos] signed URL failed:', error?.message)
      continue
    }
    urls.set(path, data.signedUrl)
  }
  return urls
}
