import type { ChallengeContent, ChallengeMeta } from '../../shared/utils/challenge'
import type { ChallengeTemplateContent } from '../../shared/utils/content/challengeTemplate'
import { validateChallengeContent } from '../../shared/utils/content/challengeTemplate'
import { isUuid } from '../../shared/utils/content/common'
import { challengeSetPublic } from './challengeContent'
import { derive, getPublicContent, invalidatePublicContent } from './publicContent'

// The current challenge template (Izazovi in the admin), as the snapshot a new fixed challenge
// stores: the template content plus `version` (the template revision) and `templateId`.
//
// It is derived from the public content snapshot: every admin write to the templates invalidates the
// snapshot (contentAfterWrite), so a switch is live on the next request in this process. With several
// processes the snapshot's background refresh bounds how long another one keeps the old template.

async function loadCurrent(): Promise<ChallengeContent> {
  const { data, error } = await useDatabaseClient().from('heritage_challenge_templates')
    .select('id, revision, content').eq('is_current', true).maybeSingle()
  if (error) databaseError(error)
  if (!data) {
    console.error('[challenge] No challenge template is current; set one in /admin/izazovi.')
    throw createError({ statusCode: 503, statusMessage: 'No current challenge template' })
  }
  try {
    return validateChallengeContent({ ...(data.content as object), version: data.revision, templateId: data.id })
  } catch (cause) {
    // The admin and the database validate every save, so this means a manual edit broke the row.
    console.error(`[challenge] The current challenge template ${data.id} is invalid:`, (cause as Error).message)
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

export async function publishedChallengeSets() {
  const { data, error } = await useDatabaseClient().from('heritage_challenge_templates')
    .select('id, content, is_current')
    .eq('status', 'published')
    .order('is_current', { ascending: false })
    .order('name', { ascending: true })
  if (error) databaseError(error)
  return (data ?? []).map(row =>
    challengeSetPublic(row.id, row.content as ChallengeTemplateContent))
}

export async function challengeContentFromSet(templateId: string): Promise<ChallengeContent> {
  const id = templateId.trim().toLowerCase()
  if (!isUuid(id)) throw new Error('Unknown set')
  const { data, error } = await useDatabaseClient().from('heritage_challenge_templates')
    .select('id, revision, content, status')
    .eq('id', id)
    .maybeSingle()
  if (error) databaseError(error)
  if (!data || data.status !== 'published') throw new Error('Unknown set')
  const templateContent = data.content as ChallengeTemplateContent
  const meta: ChallengeMeta = { ...(templateContent.meta ?? {}), source: 'set' }
  try {
    return validateChallengeContent({
      ...templateContent,
      meta,
      version: data.revision,
      templateId: data.id
    })
  } catch (cause) {
    console.error(`[challenge] Published template ${data.id} is invalid:`, (cause as Error).message)
    throw new Error('Unknown set', { cause })
  }
}
