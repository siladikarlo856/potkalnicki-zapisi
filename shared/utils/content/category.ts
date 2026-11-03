import type { ContentEntity, ContentStatus, ContentValidation } from './common'
import { contentStatus, isRecord, issueCollector } from './common'

export const CATEGORY_LIMITS = { key: 60, labelHr: 100, labelEn: 100 } as const
const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export interface HeritageCategoryValue {
  key: string
  labelHr: string
  labelEn: string | null
  sort: number
  status: ContentStatus
}

export type HeritageCategory = ContentEntity & HeritageCategoryValue

/** Validates and projects a heritage category row for the admin API. */
export function validateHeritageCategory(input: unknown): ContentValidation<HeritageCategoryValue> {
  const check = issueCollector()
  const body = isRecord(input) ? input : {}
  if (!isRecord(input)) check.add('', 'Podaci kategorije nedostaju.')
  const key = check.required('key', body.key, CATEGORY_LIMITS.key, 'Ključ')
  if (key && !KEY_PATTERN.test(key)) check.add('key', 'Ključ smije sadržavati samo mala slova, brojeve i crtice.')
  let sort = 0
  if (body.sort !== undefined && body.sort !== null && body.sort !== '') {
    if (typeof body.sort !== 'number' || !Number.isSafeInteger(body.sort)) check.add('sort', 'Polje „Redoslijed“ mora biti cijeli broj.')
    else sort = body.sort
  }
  const value: HeritageCategoryValue = {
    key,
    labelHr: check.required('labelHr', body.labelHr, CATEGORY_LIMITS.labelHr, 'Naziv (hr)'),
    labelEn: check.optional('labelEn', body.labelEn, CATEGORY_LIMITS.labelEn, 'Naziv (en)'),
    sort,
    status: contentStatus(body.status, 'published', check.add)
  }
  return { value, issues: check.issues }
}
