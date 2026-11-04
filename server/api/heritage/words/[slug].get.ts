import type { WordPageResponse } from '~~/shared/types/publicSpeech'
import { resolvePublicWord } from '~~/server/utils/words'
import { resolvedResponse } from '~~/server/utils/atlasResponse'

// GET /api/heritage/words/:slug — one word with areas and related entries; slug history → { redirect }.
export default defineEventHandler(async (event) => {
  const result = await resolvePublicWord(getRouterParam(event, 'slug') ?? '')
  return resolvedResponse<WordPageResponse>(event, result.status === 'ok'
    ? { status: 'ok', value: result.value }
    : result, 'Word not found')
})
