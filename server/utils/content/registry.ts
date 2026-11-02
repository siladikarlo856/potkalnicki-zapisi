import type { H3Event } from 'h3'
import type { ContentKind } from '../../../shared/utils/content/common'
import { isContentKind } from '../../../shared/utils/content/common'
import type { AnyContentKindDefinition } from './definition'
import { sourceKind } from './kinds/source'

// The content registry: one definition per entity kind tells the generic admin handlers
// (server/api/admin/content/[kind]/*) which table to use, how to validate and project a row,
// what may be searched, filtered and sorted, and what refers to a row. Adding an admin resource
// means adding a definition here and a page that uses the client kit; no new routes.

const REGISTRY: Record<ContentKind, AnyContentKindDefinition> = {
  source: sourceKind
}

export function contentKind(kind: ContentKind) {
  return REGISTRY[kind]
}

/** The definition named by the `:kind` route parameter; an unknown kind is a 404. */
export function contentKindParam(event: H3Event) {
  const kind = getRouterParam(event, 'kind')
  if (!isContentKind(kind)) throw createError({ statusCode: 404, statusMessage: 'Unknown content kind' })
  return contentKind(kind)
}
