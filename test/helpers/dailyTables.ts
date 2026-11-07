import { afterAll, beforeAll, beforeEach } from 'vitest'

import type { IntegrationDb } from '../support/integrationDb'

// The daily word reads every active word and every scheduled day, so its tests need those tables to themselves.
// They live in *.serial.integration.test.ts files, which run one at a time after every other integration file
// (vitest.config.ts, project node-serial). This helper empties the tables before each test and, once the file is
// done, puts back the words and days it found, so a later file still sees the seeded catalogue.

const BACKUP = 'serial_daily_backup'

/**
 * Takes over heritage_words and heritage_daily_words for one test file. Before each test, and whenever `reset()` is
 * called, every word the file added is deleted, the rest are deactivated and no day is scheduled.
 */
export function ownDailyWordTables(db: IntegrationDb) {
  // Resolved days are append-only (the heritage_daily_word_guard trigger), so they are removed with triggers off.
  // Words are deleted with triggers on, so their foreign keys still unlink submissions and drop word areas.
  const clear = `
    set session_replication_role = replica;
    delete from public.heritage_daily_words;
    set session_replication_role = default;
    delete from public.heritage_words w where not exists (select 1 from ${BACKUP}.words b where b.id = w.id);
  `
  const reset = () => {
    db.sql(`${clear} update public.heritage_words set active = false where active;`)
  }

  beforeAll(() => {
    if (!db.enabled) return
    db.sql(`
      drop schema if exists ${BACKUP} cascade;
      create schema ${BACKUP};
      create table ${BACKUP}.words as select id, active from public.heritage_words;
      create table ${BACKUP}.days as table public.heritage_daily_words;
    `)
  })
  beforeEach(() => {
    if (db.enabled) reset()
  })
  afterAll(() => {
    if (!db.enabled) return
    db.sql(`
      ${clear}
      update public.heritage_words w set active = b.active from ${BACKUP}.words b where b.id = w.id and w.active <> b.active;
      set session_replication_role = replica;
      insert into public.heritage_daily_words select * from ${BACKUP}.days;
      set session_replication_role = default;
      drop schema ${BACKUP} cascade;
    `)
  })

  return { reset }
}
