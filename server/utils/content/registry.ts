import type { H3Event } from 'h3'
import type { ContentKind } from '../../../shared/utils/content/common'
import { isContentKind } from '../../../shared/utils/content/common'
import type { AnyContentKindDefinition } from './definition'
import { challengeTemplateKind } from './kinds/challengeTemplate'
import { areaKind } from './kinds/area'
import { heritageCategoryKind } from './kinds/heritageCategory'
import { heritageItemKind } from './kinds/heritageItem'
import { sourceKind } from './kinds/source'
import { wordKind } from './kinds/word'
import { personKind } from './kinds/person'

// The content registry: one definition per entity kind tells the generic admin handlers
// (server/api/admin/content/[kind]/*) which table to use, how to validate and project a row,
// what may be searched, filtered and sorted, and what refers to a row. Adding an admin resource
// means adding a definition here and a page that uses the client kit; no new routes.

const REGISTRY: Record<ContentKind, AnyContentKindDefinition> = {
  area: areaKind,
  source: sourceKind,
  challenge_template: challengeTemplateKind,
  word: wordKind,
  heritage_category: heritageCategoryKind,
  heritage_item: heritageItemKind,
  person: personKind
}

export function contentKind(kind: ContentKind) {
  return REGISTRY[kind]
}

/** The definition of a kind that has an admin resource; undefined for any other entity kind (history lists those too). */
export function findContentKind(kind: string) {
  return isContentKind(kind) ? contentKind(kind) : undefined
}

/** The definition named by the `:kind` route parameter; an unknown kind is a 404. */
export function contentKindParam(event: H3Event) {
  const kind = getRouterParam(event, 'kind')
  if (!isContentKind(kind)) throw createError({ statusCode: 404, statusMessage: 'Unknown content kind' })
  return contentKind(kind)
}
