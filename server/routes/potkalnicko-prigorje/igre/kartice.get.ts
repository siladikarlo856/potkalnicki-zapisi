import { sendRedirect } from 'h3'
import { pzRoutes } from '~~/shared/utils/appRoutes'

/** Legacy word-cards URL (WP5 handbook). */
export default defineEventHandler((event) => {
  const query = getRequestURL(event).search
  return sendRedirect(event, `${pzRoutes.learn}?teme=rijeci${query ? `&${query.slice(1)}` : ''}`, 301)
})
