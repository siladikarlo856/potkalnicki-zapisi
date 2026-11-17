import { sendRedirect } from 'h3'
import { pzRoutes } from '~~/shared/utils/appRoutes'

/** Runs before prerendered static HTML for the removed cards page. */
export default defineEventHandler((event) => {
  if (getRequestURL(event).pathname === '/igre/kartice') {
    return sendRedirect(event, `${pzRoutes.learn}?teme=rijeci`, 301)
  }
})
