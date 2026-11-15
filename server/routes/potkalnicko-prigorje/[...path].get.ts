import { sendRedirect } from 'h3'

/** Redirect every former prefixed atlas URL while preserving its query string. */
export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const rest = url.pathname.slice('/potkalnicko-prigorje'.length)
  const legacyTargets: Record<string, string> = {
    '/igre/rijeci': '/igre?tema=rijeci',
    '/igre/crkve': '/igre?tema=bastina'
  }
  const target = legacyTargets[rest] ?? (rest || '/')
  return sendRedirect(event, `${target}${url.search ? `${target.includes('?') ? '&' : '?'}${url.search.slice(1)}` : ''}`, 301)
})
