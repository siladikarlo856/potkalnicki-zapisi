import { sendRedirect } from 'h3'
import { pzRoutes } from '~~/shared/utils/appRoutes'

/** Legacy word-cards URL (WP5 handbook). */
export default defineEventHandler((event) => {
  return sendRedirect(event, `${pzRoutes.learn}?teme=rijeci`, 301)
})
