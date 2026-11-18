import { validateCustom } from '#shared/utils/content/custom'
import { defineContentKind } from '../definition'
import { checkLinks, checkOwnLinks, deriveLabels, linkArguments, loadLinks, usedBy } from './intangible'

const VERIFICATIONS = ['unverified', 'in_review', 'verified', 'needs_update']

export const customKind = defineContentKind({
  kind: 'custom',
  table: 'customs',
  fields: {
    title: 'title',
    slug: 'slug',
    typeId: 'type_id',
    occasionId: 'occasion_id',
    description: 'description',
    quotes: 'quotes',
    steps: 'steps',
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  labelColumn: 'title',
  createdFrom: 'source_submission_id',
  validate: validateCustom,
  sorts: { title: 'title', verification: 'verification', period: 'period_sort_year', recordedYear: 'recorded_year' },
  defaultSort: 'title',
  filters: {
    verification: { column: 'verification', values: VERIFICATIONS },
    typeId: { column: 'type_id', values: [] },
    occasionId: { column: 'occasion_id', values: [] }
  },
  uniqueConstraints: { customs_slug_key: 'slug' },
  // A Folk text keeps the Custom it belonged to (folk_texts.custom_id restricts the delete).
  references: (db, id) => usedBy(db, 'folk_texts', 'custom_id', id, { kind: 'folk_text', label: 'Usmeni tekstovi' }),
  sidecars: {
    fields: ['areaLinks', 'narrators', 'authorIds', 'itemIds', 'themeIds', 'sourceIds'],
    load: async (db, id) => ({ ...await loadLinks(db, 'custom', id) })
  },
  checkLinks: async (db, value) => [
    ...await checkOwnLinks(db, [
      ['typeId', value.typeId, 'custom_types', 'Ta vrsta običaja ne postoji.'],
      ['occasionId', value.occasionId, 'occasions', 'Ta prigoda ne postoji.']
    ]),
    ...await checkLinks(db, value)
  ],
  persist: async (db, id, value, { row, revision }) => {
    const { data, error } = await db.rpc('content_custom_save', { p_id: id, p_revision: revision ?? null, p_row: row, ...linkArguments(value) })
    if (error) throw error
    return (data as string | null) ?? null
  },
  derive: (db, values) => deriveLabels(db, 'custom', 'custom_types', values, { field: 'occasionId', table: 'occasions', column: 'label_hr', label: 'occasionLabel' })
})
