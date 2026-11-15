import { sendRedirect } from 'h3'

/** Redirect the former atlas root to the new subdomain root. */
export default defineEventHandler((event) => {
  const query = getRequestURL(event).search
  return sendRedirect(event, `/${query}`, 301)
})
