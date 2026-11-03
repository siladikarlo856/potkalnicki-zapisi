// The sitemap from the database snapshot (`server/utils/publicContent.ts`).
export default defineEventHandler(async (event) => {
  const xml = contentSitemap(await getPublicContent())
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=600')
  return xml
})
