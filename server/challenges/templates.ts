import type { ChallengeContent, ChallengeMeta, ChallengeSetPublic } from '../../shared/utils/challenge'
import type { ChallengeTemplateContent } from '../../shared/utils/content/challengeTemplate'
import { isRecord, isUuid } from '../../shared/utils/content/common'
import { derive, getPublicContent, invalidatePublicContent } from '../utils/publicContent'
import { challengeSetPublic, templateChallengeContent } from './content'
import { currentTemplateRow, publishedTemplateRows, templateRow } from './database'

// The Challenge templates a new Fixed challenge copies: the current one (Izazovi in the admin) or a
// published one picked on the create form, as the snapshot the challenge stores.
//
// The current one is derived from the public content snapshot: every admin write to the templates
// invalidates the snapshot (contentAfterWrite), so a switch is live on the next request in this process.
// With several processes the snapshot's background refresh bounds how long another one keeps the old template.

async function loadCurrent(): Promise<ChallengeContent> {
  const row = await currentTemplateRow()
  if (!row) {
    console.error('[challenge] No challenge template is current; set one in /admin/izazovi.')
    throw createError({ statusCode: 503, statusMessage: 'No current challenge template' })
  }
  try {
    return templateChallengeContent(row)
  } catch (cause) {
    // The admin and the database validate every save, so this means a manual edit broke the row.
    console.error(`[challenge] The current challenge template ${row.id} is invalid:`, (cause as Error).message)
    throw createError({ statusCode: 503, statusMessage: 'Invalid current challenge template' })
  }
}

const current = derive({ get: getPublicContent }, loadCurrent)

export function currentChallengeContent(): Promise<ChallengeContent> {
  return current.get()
}

/**
 * Kept for the challenge_template kind's afterWrite; contentAfterWrite already invalidates the snapshot
 * before that hook runs, so this only repeats it.
 */
export function invalidateCurrentChallengeContent() {
  invalidatePublicContent()
}

export async function publishedChallengeSets(): Promise<ChallengeSetPublic[]> {
  return (await publishedTemplateRows()).map(row => challengeSetPublic(row.id, row.content as ChallengeTemplateContent))
}

/** The snapshot of a published Challenge template picked by id; throws 'Unknown set' otherwise. */
export async function challengeContentFromSet(templateId: string): Promise<ChallengeContent> {
  const id = templateId.trim().toLowerCase()
  if (!isUuid(id)) throw new Error('Unknown set')
  const row = await templateRow(id)
  if (!row || row.status !== 'published') throw new Error('Unknown set')
  const templateMeta = isRecord(row.content) && isRecord(row.content.meta) ? row.content.meta : {}
  const meta = { ...templateMeta, source: 'set' } as ChallengeMeta
  try {
    return templateChallengeContent(row, meta)
  } catch (cause) {
    console.error(`[challenge] Published template ${row.id} is invalid:`, (cause as Error).message)
    throw new Error('Unknown set', { cause })
  }
}
