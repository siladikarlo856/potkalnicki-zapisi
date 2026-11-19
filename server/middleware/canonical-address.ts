import { sendRedirect } from 'h3'
import { answerAddress } from '../../shared/utils/addressRedirects'

/**
 * Runs before the pages and before prerendered static HTML: a request for an old or slash-less address
 * answers 301 to the new address. `/naselja/[naselje]` needs the settlement's municipality, looked up from
 * the public content (slug history and removed settlements included).
 */
export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') return
  const { pathname, search } = getRequestURL(event)
  const answer = answerAddress(pathname, search)
  if (answer.status === 'ok') return
  if (answer.status === 'redirect') return sendRedirect(event, answer.location, 301)

  const found = settlementAnswer(await getPublicContent(), answer.slug)
  if (found.status === 'redirect') return sendRedirect(event, `${found.location}${answer.search}`, 301)
  if (found.status === 'gone') throw createError({ statusCode: 410, statusMessage: 'Content has been removed' })
  throw createError({ statusCode: 404, statusMessage: 'Settlement not found' })
})
