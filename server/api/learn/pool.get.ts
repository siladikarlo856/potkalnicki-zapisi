export default defineEventHandler(async (event) => {
  const pool = await getCardPool()
  setResponseHeader(event, 'cache-control', 'public, max-age=60, s-maxage=60')
  return pool
})
