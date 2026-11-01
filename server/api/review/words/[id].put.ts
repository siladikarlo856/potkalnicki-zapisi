export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  const id = wordIdParam(event)
  return saveWord(await readWordInput(event, id), id)
})
