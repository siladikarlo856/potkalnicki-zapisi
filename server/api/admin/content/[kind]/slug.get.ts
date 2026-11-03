import { atlasSlug } from '../../../../../shared/utils/atlasSlug'
import { isUuid } from '../../../../../shared/utils/content/common'
import { contentKindParam } from '../../../../utils/content/registry'
import { suggestContentSlug } from '../../../../utils/content/areaLookup'
import { fail, queryText } from '../../../../utils/content/store'

export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  const def = contentKindParam(event)
  const baseRaw = queryText(getQuery(event).base, 'base')
  const base = atlasSlug(baseRaw)
  if (!base) fail(400, 'Invalid base', { message: 'Parametar base nije ispravan.' })
  const scope = queryText(getQuery(event).scope, 'scope')
  const scopeId = scope && isUuid(scope) ? scope.toLowerCase() : null
  const exclude = queryText(getQuery(event).exclude, 'exclude')
  const excludeId = exclude && isUuid(exclude) ? exclude.toLowerCase() : undefined
  if (def.kind === 'heritage_item' && scope && !scopeId) fail(400, 'Invalid scope', { message: 'Parametar scope nije ispravan.' })
  const slug = await suggestContentSlug(useDatabaseClient(), def.table, base, def.kind === 'heritage_item' ? scopeId : null, excludeId)
  return { slug }
})
