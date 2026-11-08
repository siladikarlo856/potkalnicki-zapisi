import { isMemoryDraftKind } from '../../../../../shared/utils/memoryDraft'
import { isUuid } from '../../../../../shared/utils/content/common'
import { fail } from '../../../../utils/content/store'
import { draftFromMemory } from '../../../../utils/inbox'

// An editor starts a Draft Story, Custom or Folk text from a Memory: `{ kind, typeId }`. Idempotent: a Memory yields
// one Draft, so asking again returns the same one (200); a new one is 201.
export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  const id = submissionIdParam(event)
  const body = await readJsonObject(event, 1024)
  if (!isMemoryDraftKind(body.kind)) fail(400, 'Invalid kind', { message: 'Odaberi priču, običaj ili usmeni tekst.' })
  if (!isUuid(body.typeId)) fail(400, 'Invalid type', { message: 'Odaberi vrstu.' })
  const result = await draftFromMemory(id, body.kind, body.typeId)
  setResponseStatus(event, result.created ? 201 : 200)
  return result
})
