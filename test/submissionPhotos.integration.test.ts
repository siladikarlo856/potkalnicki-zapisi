import { describe, expect, it } from 'vitest'
import { integrationDb } from './support/integrationDb'

const db = await integrationDb({ server: {} })
const { sql, failure, fetch } = db

describe.skipIf(!db.enabled)('heritage_submission_photos security', () => {
  it('keeps photo rows server-only and exposes the admin photo route only to reviewers', async () => {
    expect(failure('set role anon; select count(*) from public.heritage_submission_photos;')).toMatch(/permission denied/)
    expect(failure('set role authenticated; select count(*) from public.heritage_submission_photos;')).toMatch(/permission denied/)
    expect(failure('set role anon; select public.delete_heritage_submission(1, array[]::text[]);')).toMatch(/permission denied/)
    expect(failure('set role authenticated; select public.delete_heritage_submission(1, array[]::text[]);')).toMatch(/permission denied/)
    expect((await fetch('/api/submissions/photo', { method: 'POST', body: 'x' })).status).toBe(401)
    expect((await fetch('/api/admin/inbox/1/photos')).status).toBe(401)
  })

  it('accepts the photo submission type', () => {
    const submission = sql(`insert into public.heritage_submissions (text, type, consent_publish, consent_version, locale)
      values ('Crkva u Glogovnici.', 'photo', true, '2026-11-02', 'hr') returning id;`)
    sql(`insert into public.account_profiles(id) values ('00000000-0000-4000-8000-000000000099') on conflict (id) do nothing;`)
    sql(`insert into public.heritage_submission_photos (
      submission_id, account_id, position, path, width, height, byte_size, alt, author, publish_permission
    ) values (
      ${submission},
      '00000000-0000-4000-8000-000000000099',
      0,
      'submissions/00000000-0000-4000-8000-000000000101.jpg',
      10,
      8,
      1200,
      'Crkva s juga',
      'Ana Horvat',
      true
    );`)
    expect(sql(`select type from public.heritage_submissions where id = ${submission};`)).toBe('photo')
    expect(failure(`set role service_role; select public.delete_heritage_submission(${submission}, array[]::text[]);`)).toMatch(/Submission photos changed/)
    expect(sql(`select count(*) from public.heritage_submissions where id = ${submission};`)).toBe('1')
    expect(sql(`set role service_role; select public.delete_heritage_submission(${submission}, array['submissions/00000000-0000-4000-8000-000000000101.jpg']);`)).toBe('t')
    expect(sql(`select count(*) from public.heritage_submissions where id = ${submission};`)).toBe('0')
    expect(sql(`select count(*) from public.heritage_submission_photos where submission_id = ${submission};`)).toBe('0')
    expect(sql(`select public.delete_heritage_submission(${submission}, array[]::text[]);`)).toBe('f')
  })
})
