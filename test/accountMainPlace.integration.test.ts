import { beforeAll, describe, expect, it } from 'vitest'
import { integrationDb } from './support/integrationDb'

const db = await integrationDb()
const { sql } = db

const accountA = '00000000-0000-4000-8000-000000000011'
const accountB = '00000000-0000-4000-8000-000000000012'
const publishedSettlement = 'c9731a87-1dee-807a-94ed-83d47b96fad2'

describe.skipIf(!db.enabled)('account main place persistence', () => {
  beforeAll(() => {
    sql(`insert into public.account_profiles(id) values ('${accountA}'), ('${accountB}') on conflict do nothing;`)
  })

  it('loads a saved preference on a fresh read for the same account', async () => {
    const { saveAccountMainPlace, loadAccountMainPlace } = await import('../server/utils/accountMainPlace')
    await saveAccountMainPlace(accountA, publishedSettlement)
    const fresh = await loadAccountMainPlace(accountA)
    expect(fresh.place?.id).toBe(publishedSettlement)
    expect(fresh.mainPlaceId).toBe(publishedSettlement)

    await saveAccountMainPlace(accountA, null)
    const cleared = await loadAccountMainPlace(accountA)
    expect(cleared.place).toBeNull()
    expect(cleared.mainPlaceId).toBeNull()
  })

  it('updates only the target account row', async () => {
    const { saveAccountMainPlace } = await import('../server/utils/accountMainPlace')
    await saveAccountMainPlace(accountA, publishedSettlement)
    expect(sql(`select main_place_id from public.account_profiles where id = '${accountB}';`)).toBe('')
    expect(sql(`select main_place_id from public.account_profiles where id = '${accountA}';`)).toBe(publishedSettlement)
    await saveAccountMainPlace(accountA, null)
  })

  it('writes no content rows when saving the preference', async () => {
    const beforeWords = sql(`select count(*)::text from public.heritage_words;`)
    const beforeItems = sql(`select count(*)::text from public.heritage_items;`)
    const { saveAccountMainPlace } = await import('../server/utils/accountMainPlace')
    await saveAccountMainPlace(accountA, publishedSettlement)
    await saveAccountMainPlace(accountA, null)
    expect(sql(`select count(*)::text from public.heritage_words;`)).toBe(beforeWords)
    expect(sql(`select count(*)::text from public.heritage_items;`)).toBe(beforeItems)
  })

  it('returns an archived note when the stored Naselje is archived', async () => {
    const { saveAccountMainPlace, loadAccountMainPlace, MAIN_PLACE_ARCHIVED_NOTE } = await import('../server/utils/accountMainPlace')
    await saveAccountMainPlace(accountA, publishedSettlement)
    sql(`update public.areas set status = 'archived' where id = '${publishedSettlement}';`)
    const preference = await loadAccountMainPlace(accountA)
    expect(preference.place).toBeNull()
    expect(preference.archivedNote).toBe(MAIN_PLACE_ARCHIVED_NOTE)
    sql(`update public.areas set status = 'published' where id = '${publishedSettlement}';`)
    await saveAccountMainPlace(accountA, null)
  })
})
