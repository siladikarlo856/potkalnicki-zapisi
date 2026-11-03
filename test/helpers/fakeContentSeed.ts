import type { PublicContentRows } from '../../server/utils/publicContent'
import rows from '../fixtures/fakeContentRows.json'

/** Rows for the fake Supabase REST API and component-test mocks, matching the committed atlas seed. */
export function fakeContentRows(): PublicContentRows {
  return rows as PublicContentRows
}
