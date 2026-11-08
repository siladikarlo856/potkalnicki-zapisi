import type { SupabaseClient } from '@supabase/supabase-js'
import { validateNarrator } from '#shared/utils/content/narrator'
import { defineContentKind } from '../definition'
import { missingLinkIssues } from '../linkCheck'
import { intangibleReferences } from './intangible'

const VERIFICATIONS = ['unverified', 'in_review', 'verified', 'needs_update']

type Row = Record<string, unknown>

async function labelsOf(db: SupabaseClient, table: string, ids: unknown[], column: string) {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === 'string'))]
  const labels = new Map<string, string>()
  if (!unique.length) return labels
  const { data, error } = await db.from(table).select(`id,${column}`).in('id', unique)
  if (error) throw error
  for (const row of (data ?? []) as unknown as Row[]) labels.set(row.id as string, row[column] as string)
  return labels
}

// A Narrator (Kazivač): a record of its own, not a Person (GLOSSARY.md). It has no sidecars: what a narrator told
// is the other way round, in the link tables of Stories, Customs and Folk texts (`*_narrators`), which is also what
// a narrator's public page lists.
export const narratorKind = defineContentKind({
  kind: 'narrator',
  table: 'narrators',
  fields: {
    name: 'name',
    slug: 'slug',
    publicDescription: 'public_description',
    consentNamed: 'consent_named',
    consentNote: 'consent_note',
    living: 'living',
    bornYear: 'born_year',
    settlementId: 'settlement_id',
    personId: 'person_id',
    verification: 'verification',
    researchNotes: 'research_notes',
    noindex: 'noindex'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  labelColumn: 'name',
  // search_text leaves the name out without consent; editors look a narrator up by the name column itself.
  searchAlso: 'name',
  validate: validateNarrator,
  sorts: { name: 'name', verification: 'verification', bornYear: 'born_year' },
  defaultSort: 'name',
  filters: {
    verification: { column: 'verification', values: VERIFICATIONS }
  },
  uniqueConstraints: { narrators_slug_key: 'slug', narrators_person_id_key: 'personId' },
  // The Stories, Customs and Folk texts told or collected by this narrator block a hard delete: archive instead.
  references: (db, id) => intangibleReferences(db, 'narrator', id),
  // The home settlement is a settlement and the linked Person exists, so a bad link is an issue on its field rather
  // than a database error. Each Person belongs to at most one Narrator (narrators_person_id_key).
  checkLinks: async (db, value) => [
    ...await missingLinkIssues(db, 'areas', value.settlementId ? [['settlementId', value.settlementId] as const] : [], 'Mjesto življenja mora biti naselje.', { column: 'kind', value: 'settlement' }),
    ...await missingLinkIssues(db, 'persons', value.personId ? [['personId', value.personId] as const] : [], 'Ta osoba ne postoji.')
  ],
  // The home settlement's name and the linked Person's name, for the admin list.
  async derive(db, values) {
    const settlements = await labelsOf(db, 'areas', values.map(value => value.settlementId), 'name')
    const persons = await labelsOf(db, 'persons', values.map(value => value.personId), 'name')
    return values.map(value => ({
      ...value,
      settlementLabel: settlements.get(value.settlementId as string) ?? null,
      personLabel: persons.get(value.personId as string) ?? null
    }))
  }
})
