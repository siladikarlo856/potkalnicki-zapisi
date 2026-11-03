// The sitemap from the database. Inactive while public/sitemap.xml exists: Nitro serves a public file
// before any route, so the static sitemap shadows this one until it is deleted.
export default defineEventHandler(async (event) => {
  const xml = contentSitemap(await getPublicContent())
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=600')
  return xml
})
