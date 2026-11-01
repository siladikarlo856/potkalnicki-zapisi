import { randomUUID } from 'node:crypto'

export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  const input = await readWordInput(event, randomUUID())
  const result = await saveWord(input)
  setResponseStatus(event, 201)
  return result
})
