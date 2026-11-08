import { validateStory } from '#shared/utils/content/story'
import { defineContentKind } from '../definition'
import { checkLinks, checkOwnLinks, deriveLabels, linkArguments, loadLinks } from './intangible'

const VERIFICATIONS = ['unverified', 'in_review', 'verified', 'needs_update']

export const storyKind = defineContentKind({
  kind: 'story',
  table: 'stories',
  fields: {
    title: 'title',
    slug: 'slug',
    typeId: 'type_id',
    textLocal: 'text_local',
    textStandard: 'text_standard',
    period: 'period',
    periodUnit: 'period_unit',
    periodValue: 'period_value',
    recordedPrecision: 'recorded_precision',
    recordedYear: 'recorded_year',
    recordedMonth: 'recorded_month',
    recordedDay: 'recorded_day',
    verification: 'verification',
    researchNotes: 'research_notes',
    noindex: 'noindex'
  // The links (areaLinks, people, itemIds, themeIds, sourceIds) live in link tables (sidecars), not on the row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  labelColumn: 'title',
  // A Draft made from a Memory points back at it; publishing the Draft applies the Memory (content_apply_submission).
  createdFrom: 'source_submission_id',
  validate: validateStory,
  sorts: { title: 'title', verification: 'verification', period: 'period_sort_year', recordedYear: 'recorded_year' },
  defaultSort: 'title',
  filters: {
    verification: { column: 'verification', values: VERIFICATIONS },
    typeId: { column: 'type_id', values: [] }
  },
  uniqueConstraints: { stories_slug_key: 'slug' },
  references: async () => [],
  sidecars: {
    fields: ['areaLinks', 'people', 'itemIds', 'themeIds', 'sourceIds'],
    load: async (db, id) => ({ ...await loadLinks(db, 'story', id) })
  },
  checkLinks: async (db, value) => [
    ...await checkOwnLinks(db, [['typeId', value.typeId, 'story_types', 'Ta vrsta priče ne postoji.']]),
    ...await checkLinks(db, value)
  ],
  // The stories row and its links in one transaction (supabase/migrations/20261108010000_intangible_heritage_save.sql).
  persist: async (db, id, value, { row, revision }) => {
    const { data, error } = await db.rpc('content_story_save', { p_id: id, p_revision: revision ?? null, p_row: row, ...linkArguments(value) })
    if (error) throw error
    return (data as string | null) ?? null
  },
  // The type's label and the places it was recorded in, for the admin list.
  derive: (db, values) => deriveLabels(db, 'story', 'story_types', values)
})
