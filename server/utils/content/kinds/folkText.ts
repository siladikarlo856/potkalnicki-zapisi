import { validateFolkText } from '#shared/utils/content/folkText'
import { missingLinkIssues } from '../linkCheck'
import { defineContentKind } from '../definition'
import { checkLinks, checkOwnLinks, deriveLabels, linkArguments, loadLinks, loadWordIds } from './intangible'

const VERIFICATIONS = ['unverified', 'in_review', 'verified', 'needs_update']

export const folkTextKind = defineContentKind({
  kind: 'folk_text',
  table: 'folk_texts',
  fields: {
    title: 'title',
    slug: 'slug',
    typeId: 'type_id',
    customId: 'custom_id',
    textLocal: 'text_local',
    textStandard: 'text_standard',
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
  validate: validateFolkText,
  sorts: { title: 'title', verification: 'verification', recordedYear: 'recorded_year' },
  defaultSort: 'title',
  filters: {
    verification: { column: 'verification', values: VERIFICATIONS },
    typeId: { column: 'type_id', values: [] },
    customId: { column: 'custom_id', values: [] }
  },
  uniqueConstraints: { folk_texts_slug_key: 'slug' },
  references: async () => [],
  sidecars: {
    fields: ['areaLinks', 'people', 'itemIds', 'themeIds', 'sourceIds', 'wordIds'],
    load: async (db, id) => ({ ...await loadLinks(db, 'folk_text', id), wordIds: await loadWordIds(db, id) })
  },
  checkLinks: async (db, value) => [
    ...await checkOwnLinks(db, [
      ['typeId', value.typeId, 'folk_text_types', 'Ta vrsta usmenog teksta ne postoji.'],
      ['customId', value.customId, 'customs', 'Taj običaj ne postoji.']
    ]),
    ...await missingLinkIssues(db, 'heritage_words', value.wordIds.map((id: string, index: number) => [`wordIds.${index}`, id] as const), 'Ta riječ ne postoji.'),
    ...await checkLinks(db, value)
  ],
  persist: async (db, id, value, { row, revision }) => {
    const { data, error } = await db.rpc('content_folk_text_save', {
      p_id: id, p_revision: revision ?? null, p_row: row, ...linkArguments(value), p_word_ids: value.wordIds ?? []
    })
    if (error) throw error
    return (data as string | null) ?? null
  },
  derive: (db, values) => deriveLabels(db, 'folk_text', 'folk_text_types', values, { field: 'customId', table: 'customs', column: 'title', label: 'customLabel' })
})
