import type { ChallengeContent, ChallengeMeta } from '../../shared/utils/challenge'
import type { ChallengeTemplateContent } from '../../shared/utils/content/challengeTemplate'
import { validateChallengeContent } from '../../shared/utils/content/challengeTemplate'
import { isUuid } from '../../shared/utils/content/common'
import { challengeSetPublic } from './challengeContent'

// The current challenge template (Izazovi in the admin), as the snapshot a new fixed challenge
// stores: the template content plus `version` (the template revision) and `templateId`.
//
// It is read through a small in-process cache, like the public content snapshot: fresh for 60 s,
// refreshed by one request at a time, kept when a refresh fails, and dropped by every admin write
// to the templates (the content kind's afterWrite), so a switch is live on the next request in this
// process. With several processes the TTL bounds how long another one keeps the old template.

const TTL_MS = 60_000

interface Snapshot {
  content: ChallengeContent
  loadedAt: number
}

let cached: Snapshot | null = null
let pending: Promise<ChallengeContent> | null = null
let generation = 0

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

export async function currentChallengeContent(): Promise<ChallengeContent> {
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return cached.content
  if (!pending) {
    const started = generation
    const request = loadCurrent().then((content) => {
      // A write during the load may have changed the template; keep only what is still current.
      if (started === generation) cached = { content, loadedAt: Date.now() }
      return content
    })
    pending = request
    request.then(() => undefined, () => undefined).finally(() => {
      if (pending === request) pending = null
    })
  }
  try {
    return await pending
  } catch (error) {
    if (cached) {
      console.error('[challenge] Refreshing the current challenge template failed; serving the last one.')
      return cached.content
    }
    throw error
  }
}

/** After an admin write: the next request reads the database again. */
export function invalidateCurrentChallengeContent() {
  generation++
  pending = null
  cached = null
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
