// The sitemap from the database snapshot (`server/utils/publicContent.ts`).
export default defineEventHandler(async (event) => {
  const content = await getPublicContent()
  const words = await publicWordSitemap()
  const xml = contentSitemap(content, words)
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=600')
  return xml
})
