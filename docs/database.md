# Database migrations and production rollout

Schema changes live in `supabase/migrations/`. Add a new timestamped SQL file for each change; do not edit a migration that has already been applied. Keep migrations compatible with the currently running app: the database changes before Hostinger builds the new app. The Supabase CLI tracks applied versions in `supabase_migrations.schema_migrations`; SQL Editor does not populate this history automatically.

Supabase's [migration guide](https://supabase.com/docs/guides/deployment/database-migrations) and [CLI reference](https://supabase.com/docs/reference/cli/global-flags) explain history repair and dry runs. History checks compare version numbers; they do not detect every manual schema edit or changes to an already applied SQL file.

## One-time production setup (owner)

Do this before merging app changes that require a new schema. These commands are production operations for the owner to run; CI does not repair history automatically.

1. Turn off the Node.js app's automatic deployment from `main` in Hostinger before proceeding. Keep the currently deployed app running.
2. Install **Supabase CLI 2.122.0** (the version pinned in `.gitea/workflows/production.yml`). In a checkout of the latest `main`, authenticate and inspect history:

   ```bash
   supabase --version
   supabase login
   supabase link --project-ref <production-project-ref>
   supabase migration list --linked
   ```

   Supply the production database password when prompted. Never commit it or paste credentials into an issue or workflow log.
3. Compare each local migration with what is actually installed in production. The existing site had these files applied manually through SQL Editor:

   | Version | File | Verify before marking applied |
   | --- | --- | --- |
   | `20261027000000` | `20261027000000_heritage_submissions.sql` | `public.heritage_submissions`, its columns, constraints, index and RLS exist. |
   | `20261027010000` | `20261027010000_server_only_submissions.sql` | The anonymous insert policy is removed; public/anonymous/authenticated table, column and sequence grants are revoked. |

   If the schema matches and those versions are missing from the **Remote** column, record them as applied:

   ```bash
   supabase migration repair --linked --status applied 20261027000000 20261027010000
   supabase migration list --linked
   supabase db push --linked --dry-run --skip-vault
   ```

   `repair --status applied` changes history only; it does not execute SQL. Mark only migrations whose effects you have verified. If just one is missing, pass only that version. If additional migrations have already been applied manually, inspect and repair their individual versions in the same way. **Do not mark pending migrations applied.** The two baseline versions must now appear in both Local and Remote; the dry run should list only genuinely new files. If there is an unknown remote version or a missing older version, stop and reconcile history with the actual schema before proceeding. Never use `--include-all`, remote reset, or blanket history repair to bypass a discrepancy.

   For a genuinely empty new production database, first review and run `supabase db push --linked --skip-vault` manually to create the initial schema and history. The automatic workflow intentionally refuses an empty baseline, because the existing production schema cannot safely be inferred from empty history.
4. In **GitHub repository → Settings → Secrets and variables → Actions → Repository secrets**, add all three:

   | Secret | Value |
   | --- | --- |
   | `SUPABASE_ACCESS_TOKEN` | A Supabase personal access token from account settings, authorized for the production project. This is a CLI management token, not the app's API key. |
   | `SUPABASE_DB_PASSWORD` | The production project's Postgres database password. |
   | `SUPABASE_PROJECT_REF` | The production project reference from the Supabase dashboard/project URL. |

   These are Gitea Actions repository secrets (Settings → Actions → Secrets), separate from the app's Hostinger runtime variables. No production credentials are used on pull requests. If any secret is absent, the production job exits successfully with a **Production rollout skipped** notice, without linking, migrating, or promoting a branch. A green workflow with this notice is not a completed rollout.
5. Create a `production` branch pointing to the **currently deployed, schema-compatible commit**, which must be an ancestor of `main`:

   ```bash
   git fetch origin
   git push origin <currently-deployed-commit-sha>:refs/heads/production
   ```

   This is a one-time branch creation, without force. If the branch already exists, inspect it rather than overwriting it. Configure repository rules so this workflow can fast-forward `production` using its built-in `GITHUB_TOKEN` (`contents: write`), and prevent other writers from deploying unverified commits. A rule that requires a PR for every update to `production` will block automatic promotion unless the workflow has an approved exception. Never force-push or merge unrelated commits onto this branch.
6. In the Hostinger **Node.js app's deployment/settings**, change the tracked Git branch from `main` to **`production`**, then enable automatic deployment for that branch only. Confirm the selected branch and deployed commit in Hostinger's deployment details. Changing settings may immediately redeploy the selected branch, which is why it must initially point to the already verified live commit. Do not reconnect the repository to `main` as a shortcut.
7. After this workflow is on `main`, run **Actions → Production database and deploy → Run workflow → main**, or push a new commit to `main`. Confirm that both the migration step and branch promotion succeeded, then check Hostinger's build/deployment log and test submissions/review.

## Automatic order and Hostinger support

The workflow runs on pushes to `main`; manual dispatch on `main` supports retries. It first applies all migration files to a fresh disposable Postgres database. Pull requests run this local validation too, without production credentials.

The production job uses a single concurrency group with cancellation disabled: two workflow runs cannot migrate production simultaneously. It checks out the triggering SHA, skips stale runs if `main` has advanced, and verifies that `production` can fast-forward to that SHA **before database changes**. It links to Supabase, verifies the two historical baseline entries, then runs `supabase db push --linked --dry-run --skip-vault --yes` to reject inconsistent history before applying any pending migrations. Only then does `supabase db push --linked --skip-vault --yes` apply the pending files, regardless of how many there are. Successful completion permits an ordinary, non-forced push of that exact SHA to `production`.

[Hostinger's Node.js guide](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/) documents automatic deployment from a selected branch through the GitHub App. It does not document a Node.js deploy webhook; the older [Git deployment webhook guide](https://support.hostinger.com/en/articles/1583302-how-to-deploy-a-git-repository) concerns a different deployment flow. This setup therefore uses a dedicated branch to trigger deployment after migration, rather than an undocumented webhook. No `HOSTINGER_DEPLOY_WEBHOOK_URL` secret is needed.

With Hostinger tracking `production`, a failed or skipped migration cannot advance the deployment branch. **If Hostinger still tracks `main`, its independent deploy-on-push can race the migration workflow, including when CI fails.** Merging or deploying app code without this workflow and its secrets configured does not apply migrations. If the Node.js app settings do not offer a branch change, leave automatic deployment off and use the manual fallback below; do not assume ordering is enforced.

Branch promotion reports that deployment was requested; Actions does not wait for Hostinger's build or verify the live site. Check Hostinger for build failure or a missing GitHub App event. Even a successful migration may leave the old app running if promotion or the Hostinger build fails, so changes must remain compatible with it. CI concurrency covers this workflow, not manual SQL or another external migration tool; do not run those concurrently with it.

## Croatian settlement picker rollout

`20261030000000_submission_places.sql` adds nullable `place_id` and `place_catalog_version` columns to `heritage_submissions`. It sorts after the word and submission-withdrawal migrations and does not change their tables or triggers. The new picker migration has not been applied to production; do not record it as already applied during baseline history repair.

The normal configured workflow applies this pending migration on a push to `main`, before fast-forwarding `production` and triggering Hostinger's app build. No separate manual picker-migration step is required. Keep the catalog, ID validation and form in the same promoted commit. The migration leaves existing free-text locations untouched, keeps the original 120-character place constraint and RLS, and does not backfill IDs or geocode legacy text. The app's environment variables do not change.

Before production rollout, verify on staging that selected HR IDs store a canonical label snapshot and catalog version, omitted places remain null, invalid/foreign/inactive IDs and old-client free text are rejected, and legacy rows remain readable as unverified. After rollout, verify both new columns are nullable, the original length constraint and public-access restrictions remain, and the HR/EN form and private review work using an approved synthetic entry. Remove the test entry after verification. Check the actual deployed SHA in Hostinger as well as the Actions result.

If automation is unavailable, use the [manual fallback](#manual-fallback) with auto-deployment disabled and apply all pending migrations before deploying the exact verified commit. Do not bypass history validation or mark the pending picker migration applied without executing it. If migration or promotion fails, follow [failure and recovery](#failure-and-recovery); leave the old compatible app running until the workflow or fallback succeeds.

For an app rollback, retain the nullable columns, catalog references and all stored place strings. Older app code ignores the additions and can still write null IDs; the picker version treats those free-text rows as legacy/unverified when restored. Do not drop the columns or destructively backfill locations as part of rollback. The workflow does not automatically revert the schema or deployed app.

## Heritage correction submissions

`20261102100000_submission_corrections.sql` adds the `correction` submission type and nullable `target_ref` (atlas item id). It sorts after the seed migrations and does not change word tables or triggers. The constraint requires `target_ref` when `type = 'correction'` and forbids it on other types. Legacy rows keep null `target_ref` and their existing types. Superseded: corrections now use `target_kind` + `target_id`, the app no longer writes `target_ref`, and `20261103130000_retire_target_ref_requirement.sql` relaxed the requirement (see [Retiring the content files](#retiring-the-content-files-contract)).

Apply through the normal production workflow before deploying the matching app. On staging, verify a correction stores the atlas id, unknown ids are rejected, and legacy rows stay readable. `node scripts/test-correction-migration.mjs` checks the SQL against an already-running local Postgres inside a rolled-back transaction, like the place-picker script.

## Daily word schedule rollout

`20261102110000_heritage_daily_words.sql` adds `heritage_daily_words`: one row per Europe/Zagreb day with the chosen word, the options and clues frozen for that day, optional admin pins and an audit list of replaced words. It is additive, enables RLS with no anon/authenticated grants (service role only) and adds a guard trigger. It does not change `heritage_words`. The version is deliberately later than `20261102100000_submission_corrections.sql`: a timestamp earlier than an already applied remote migration would fail the workflow's history check, and `--include-all` must never be used to get around that.

The daily word is live from `DAILY_WORD_EPOCH` (`2026-11-02`, day 1) in `shared/utils/dailyWord.ts`; before that day `GET /api/heritage/daily` answers 404 `not-started` and never writes a row. This migration must be applied in production before the app deploys, because the first request of the day writes the day's row. The launch was made visible early to see how it looks and feels, with the word pool growing over time. Set `NUXT_DAILY_WORD_EPOCH` to a future date to hide it again.

Apply it through the normal migration-first workflow (the worker did not apply anything to production):

1. Merge to `main`; Actions applies the pending migration, then fast-forwards `production`. Before that, confirm the dry run lists only this file as pending.
2. Verify: `\d public.heritage_daily_words` shows RLS enabled and the guard trigger; `anon` and `authenticated` get `permission denied`; the table is empty.
3. The previously deployed app ignores the table, so migrating first is safe. Roll back app code first if needed and leave the additive table, trigger and rows in place; do not drop them. A resolved day cannot be deleted (the trigger refuses it), which is intended: it is what every visitor saw. To retire a mistaken pin, delete the unresolved row.

`node scripts/test-seed-reload-migration.mjs` runs the seed reload migration against an already-running local Postgres inside a rolled-back transaction: pinned and resolved daily rows on old text ids are removed, 61 UUID words (51 active) exist, an unrelated word and its daily row survive, and `heritage_daily_word_guard` stays enabled.

`node scripts/test-challenges.mjs` applies every migration to a disposable Postgres and checks the table's RLS, constraints, guard trigger, the concurrent first-insert race on the primary key, and the resolver end to end (pin, skipped pin, withdrawal replacement).

## Seed word reload

`20261102120000_reload_seed_words.sql` replaces the seeded words with the reviewed list in one transaction. It deletes the 61 ids created by `20261028010000_heritage_words.sql` and `20261101010000_seed_kajkavian_words.sql` (hiza, babica and the others), only where `submission_id` is null, then inserts the 61 corrected words with UUID ids stored as text in the existing `id` column (`entry->>'id'` equals the column). 51 are active and `verified`; 10 are `active = false` with status `placeholder`. Every word has one usage in `hr-kkz-sveti-petar-orehovec` and keeps its source credit. The `category` values on active words are proposals for editorial review; examples, notes and distractors are empty.

What it touches, so it cannot fail on a reference:

- `heritage_daily_words.word_id` is a foreign key to `heritage_words`. Rows pointing at the deleted ids, pinned or resolved, are deleted first. Resolved days are protected by `heritage_daily_word_guard`, so the migration disables that trigger for the one delete and re-enables it before the word delete, inside the transaction. A day that was already shown to visitors is therefore lost and the next request resolves that day again with a new word; `replaced_word_ids` is a plain array and needs no change.
- `heritage_challenges.content` stores its own question snapshots and `heritage_submissions.target_ref` is an atlas item id, so neither references word ids; existing quiz challenges keep working from their snapshots.
- Any other `heritage_words` row, and any row linked to a submission, is not touched.

The inserts use `on conflict (id) do nothing`, so replaying the file never overwrites a later edit. Words move to UUID ids, so client-side progress that stored an old text id (for example daily word stats for `hiza`) no longer matches a word; nobody uses the app yet, which is why this was accepted. The migration is applied by the normal workflow; the old text-id seed migrations stay in history and are not edited. `test/seedReload.test.ts` checks the delete list, the order of statements and every inserted entry against `validateWord`.

## Submission word link rollout

`20261103000000_submission_word_link.sql` adds two nullable columns to `heritage_submissions` for contributions sent from the daily word: `word_id` (text, references `heritage_words(id)` with `on delete set null`) and `intent` (`variant` or `usage`), with a check that an `intent` needs a `word_id`. It is additive and sorts after every earlier migration, including `20261102110000_heritage_daily_words.sql`. Existing rows and policies are unchanged: RLS and the missing anon/authenticated grants still apply to the whole table.

Apply it through the normal migration-first workflow before deploying the matching app. The previously deployed app never reads or writes the columns, so migrating first is safe, and the new app only sends them for a linked contribution, so ordinary submissions still work if it runs briefly before the migration. Roll back the app first if needed and leave the columns in place. `word_id` is plain text, so it follows whatever the word ids are.

The withdrawal trigger only acts on words created *from* a submission (`heritage_words.submission_id`), so deleting a usage confirmation never deactivates the word it points at. Because `intent` requires `word_id`, a `before delete` trigger on `heritage_words` (`heritage_words_unlink_submissions`, empty `search_path`, execute revoked from public roles) clears `word_id` and `intent` on linked submissions first, so a word can be hard-deleted (as the seed reload migration does) and the contribution survives unlinked.

## Content tables

`20261103010000_content_tables.sql` creates the database home for the atlas content that used to be read from `content/atlas/*.json` (the files are retired; see [Retiring the content files](#retiring-the-content-files-contract)). It is the first step of the content admin plan: nothing reads these tables yet, and the rows arrive in the [atlas content import](#atlas-content-import), so the tables start empty. The version sorts after every migration on `main` and after `20261103000000_submission_word_link.sql`; if another migration lands first with a later timestamp, rename this file to sort after it before merging.

What it adds:

- `areas`: one place hierarchy for the atlas and word usages. Kinds are `country`, `county`, `region`, `town`, `municipality` and `settlement`. A trigger enforces the parent kind (county under country, region under country or county, town or municipality under county, settlement under town or municipality); only a country has no parent, and because each kind sits below its parent's, a cycle is impossible. Slugs are unique per public URL namespace (towns and municipalities share one), `(kind, official_code)` and `geonames_id` are unique, and a published town, municipality or settlement needs a slug. Changing a kind is refused while children, heritage items or region memberships depend on it. Moving a settlement to another town or municipality moves its heritage items along.
- `area_regions`: region membership (for example the five municipalities of Potkalničko prigorje). The region must be of kind `region`; countries and regions cannot be members.
- `heritage_categories` (stable `key` plus Croatian and English labels), `sources`, `heritage_items` (churches, chapels, crosses and sites, with `verification` for the public badge, the dataset's period, registry number and heritage status, credits and `dataset_id` provenance) and the ordered `heritage_item_sources` links. An item's settlement must belong to its municipality, and an item slug is unique within its settlement.
- `content_legacy_ids` (old ids such as `krizevci` or `krizevci-crkva-sv-ane` → UUID), `content_slug_history` (old public slugs, written by trigger so old URLs can redirect; keyed by kind, URL namespace, scope and slug, where an area's namespace is the old row's, so a town and a settlement with the same slug keep separate rows, and a kind change that moves an area to another namespace is recorded too) and `content_revisions` (a full row snapshot of every insert, update and delete).
- Helpers `content_uuid(name)` (deterministic UUIDv8 from a name, used by the seed so every environment gets the same ids) and `content_fold(text)` (accent-folded lowercase for search).

Every content table has a UUID `id`, `status` (`draft`, `published`, `archived`), a database-managed `revision` (bumped on each update; an API that updates `where revision = <expected>` gets no row back on a concurrent edit, and setting it directly is refused), `created_at`/`updated_at` maintained by trigger, an immutable `id` and an accent-folded `search_text`. Revisions record the actor from the transaction setting `app.actor` (`admin` when unset; seed migrations set `import`). Every reference uses `on delete restrict`, except that deleting an item drops its source links and deleting an area drops its own region memberships. Legacy ids and slug history have no foreign key on purpose, so they survive a hard delete and resolve again after a restore. RLS is enabled on all nine tables, nothing is granted to `public`, `anon` or `authenticated`, and only `service_role` can read, write or call the helpers, like every other table.

Apply it through the normal migration-first workflow. The previously deployed app ignores the new tables, so migrating first is safe, and an app rollback keeps them: do not drop them to roll back. After rollout, verify that `\dt public.*` lists the nine tables with RLS enabled, that `anon` and `authenticated` get `permission denied`, and that the tables are empty.

`node scripts/test-challenges.mjs` also runs `test/content.integration.test.ts` on its disposable Postgres and PostgREST: the deterministic UUIDs (SQL against the Node implementation), public-role denial in SQL and through PostgREST, revisions and stale-update refusal, history rows with their actor (deletes included), the area hierarchy, slug and code uniqueness, region membership, the item place rule and settlement moves, slug history and `restrict` deletes.

## Atlas content import

`20261103020000_seed_content.sql` imports the atlas into the content tables once. It sorts after `20261103010000_content_tables.sql`, which it fills; if another migration lands first with a later timestamp, rename this file to sort after it before merging.

What it inserts, all with `status = 'published'`:

- `areas`: Hrvatska (country) and Koprivničko-križevačka županija (county), from the word-area keys in `content/heritage/areas.json` (now `test/fixtures/heritage/areas.json`); the region Potkalničko prigorje (slug `potkalnicko-prigorje`) below the county; Križevci as a `town` and Kalnik, Gornja Rijeka, Sveti Petar Orehovec and Sveti Ivan Žabno as `municipality` rows below the county, with today's slugs (`grad-krizevci`, `opcina-kalnik`, …). The stored name is the bare place name; "Grad"/"Općina" comes from the kind, which reproduces today's labels. Then the 135 settlements from `content/atlas/settlements.json` below their town or municipality, with the DGU code as `official_code`, the centroid and the `geonames_id` of the one active place-catalog entry with that code (`server/data/places/hr.json`).
- `area_regions`: the five towns and municipalities as members of Potkalničko prigorje.
- `heritage_categories`: the 10 dataset categories with today's Croatian labels and sort order (`monastery` is defined but unused); English labels are left empty.
- `sources`: the 10 sources.
- `heritage_items`: the 107 items of `content/atlas/heritage.json` (now `test/fixtures/atlas/heritage.json`) with the same name, slug, category, municipality, settlement (12 have none), locality, `verification` (from `status`), research notes and `noindex`; `dataset_id` is the dataset record id. From the source dataset (`data/heritage/…json`) they also get `period` (7 items), `registry_number` (19) and `heritage_status` (100 `needs_verification`, 7 `historical_site`); description and coordinates are empty there, so they stay null.
- `heritage_item_sources`: 137 links, in the item's source order.
- `content_legacy_ids`: every import key, plus `hr-kkz-krizevci` and `hr-kkz-sveti-petar-orehovec` (the word usages' town and municipality keys, mapped to the same rows as `krizevci` and `svetiPetarOrehovec`) and the 55 dataset item ids with diacritics (`križevci-crkva-sv-ane`).

Ids are deterministic: `content_uuid('<kind>:<import key>')`, where the import key is the pre-UUID id (`area:hr`, `area:krizevci`, `area:000299` for a settlement's DGU code, `heritage_category:church`, `source:registar-kulturnih-dobara`, `heritage_item:krizevci-crkva-sv-ane`). Local, CI and production therefore hold the same ids, and code and tests can compute them. The file runs in one transaction with `set local app.actor = 'import'`, so the content triggers write one `insert` revision per row with actor `import`. Words are not part of the import: they are already in `heritage_words`.

The file was generated once from the JSON files, the source dataset and the place catalog; the generator (`scripts/generate-content-seed.mjs`), its drift test and the files are retired (see [Retiring the content files](#retiring-the-content-files-contract)). The migration is applied and must not change: content edits go into the database, not into files. `node scripts/test-challenges.mjs` also runs `test/contentSeed.integration.test.ts` on its disposable Postgres: every imported row field by field against the frozen copies of the files in `test/fixtures/atlas` and `test/fixtures/heritage`, the counts (5 towns and municipalities, 135 settlements, 10 categories, 10 sources, 107 items), legacy-id resolution, deterministic ids, the import revisions, and that replaying the file changes nothing.

Apply it through the normal migration-first workflow. It only inserts, each statement with `on conflict do nothing`, so a replay never overwrites a later edit, and the previously deployed app ignores the rows: migrating first is safe, and an app rollback keeps them. After rollout, verify the counts: `select kind, count(*) from public.areas group by kind;` gives 1 country, 1 county, 1 region, 1 town, 4 municipality and 135 settlement rows; `heritage_items` has 107 rows, `sources` and `heritage_categories` 10 each; and `select count(*) from public.content_revisions where actor = 'import';` gives 270.

## Word admin columns

`20261103030000_word_admin_columns.sql` brings `heritage_words` under the content-table conventions without changing its id type. Ids stay `text`: `20261102120000_reload_seed_words.sql` already gave every word a UUID id stored as text, the app inserts `randomUUID()` strings, and `heritage_daily_words.word_id` and `heritage_submissions.word_id` keep their text foreign keys. The version sorts after `20261103010000_content_tables.sql`, whose shared tables and functions it uses; if another migration lands first with a later timestamp, rename this file to sort after it before merging.

What it adds:

- `heritage_words_id_uuid`: every id must be a lowercase UUID string. Lowercase matters because polymorphic uuid columns such as `content_revisions.entity_id` store `id::uuid`, and Postgres prints a uuid in lowercase, so a word is found again with `id = entity_id::text`. Before adding the check, the migration lists up to 20 offending ids and stops (`heritage_words ids must be lowercase UUID strings; found {…}`), so a text-id row that survived the reload fails the rollout loudly instead of being half-migrated. The whole file is one transaction, so nothing else is applied in that case.
- `slug`: unique, at most 120 characters, the same shape as atlas slugs. `content_slug(text)` is the SQL twin of `atlasSlug()` in `shared/utils/atlasSlug.ts` (đ → dj, diacritics dropped, lowercase ASCII words joined by hyphens; null where `atlasSlug` returns an empty string). `heritage_word_slug(headword, id)` picks a free slug from the first non-blank headword, adding `-2`, `-3` for homographs, falling back to `rijec` for a headword without letters or digits, and serializing concurrent writers of the same base with a transaction advisory lock. The slug is kept when the headword changes later, so a future dictionary URL stays stable; setting it to null asks for a new one from the current headword. A draft with a blank headword has no slug until it gets one, and an active word always has one (`heritage_words_active_slug`). It is never used as an id.
- `revision` (starts at 1, bumped on every update; setting it directly is refused, so an API that updates `where revision = <expected>` gets no row back on a concurrent edit), `archived_at` (set by a later admin when it archives a word; activating the word clears it) and `search_text` (accent-folded headword, variant forms and Croatian and English meanings, from `heritage_word_search_text(entry)`).
- `heritage_words_before_write`, a `BEFORE INSERT OR UPDATE` trigger with the `content_before_write` rules (immutable id, managed revision, `created_at` kept, `updated_at` set) plus the derived columns above. The existing `heritage_word_before_save` trigger keeps approving a linked submission on activation.
- History: `content_audit('word')` copies every insert, update and delete to `content_revisions` with `entity_kind = 'word'` and `entity_id = id::uuid`. The migration first writes a baseline `insert` row (revision 1, actor `import`) for every existing word, so the first edit can be undone. A changed slug is kept in `content_slug_history` (kind `word`, empty namespace, no scope). For that, `content_slug_history_write()` is replaced with an identical function that reads the entity id through jsonb and casts it, as `content_audit` does; the uuid-keyed content tables behave as before.

The backfill sets `slug` and `search_text` for the existing words, oldest first, with `heritage_word_before_save` paused and before the revision and history triggers exist, so `updated_at` and `revision` are unchanged and the backfill is not recorded as an edit. The new helpers are server-only like the other content helpers (no `EXECUTE` for `public`, `anon` or `authenticated`). No word was given an old→new id map by the reload, so no `content_legacy_ids` rows are written for words; old slug ids such as `hiza` stay unresolvable, as accepted when the words were reloaded.

Apply it through the normal migration-first workflow. The previously deployed app keeps working during the deploy window and after a rollback: its inserts already use UUID ids and omit the new columns, which are defaulted or filled by the trigger, and its updates never send `revision`. An app rollback keeps the columns, triggers and history: do not drop them. After rollout, verify that every word has a UUID id, that active words have a unique slug, that `revision` is 1 on words not edited since, and that `content_revisions` holds one baseline row per word.

`node scripts/test-challenges.mjs` runs `test/wordColumns.integration.test.ts` on its disposable Postgres: the backfilled slugs and baseline revisions of the seeded words, the id check (text, uppercase and suffixed ids refused), `content_slug` against `atlasSlug`, homograph suffixes and slug stability, revision and stale-update refusal, history rows (deletes included), archiving, slug history and the previous app's insert and update. The admin **Riječi** screen uses the generic `/api/admin/content/word` handlers: list search runs against `search_text`, publication is `active` with `archived_at` mapped to the kit's `status`, archive sets `active = false` and `archived_at`, and hard delete stays blocked while `heritage_daily_words` references the word. `test/adminWords.integration.test.ts` covers that API on the same disposable database.

## Word areas from the areas table

`20261103120000_word_areas.sql` links words to the `areas` table introduced in `20261103010000_content_tables.sql`. It depends on that file and on `20261103030000_word_admin_columns.sql`, and on nothing newer. Its version was originally `20261103040000`; it merged after `20261103100000_challenge_templates.sql` had already been applied to production, so the workflow's history check refused the older version ("Found local migration files to be inserted before the last migration on remote database"). It was renamed to sort after every migration then on `main`, including `20261103110000_contributions_inbox.sql`, which it runs after; its backfill updates `heritage_words` with `content_apply_submission` enabled, and that trigger ignores rows that carry no submission. Production never had the old version in its history, so nothing needs repairing. Never rename a migration that has been applied.

What it adds:

- `heritage_word_areas(word_id text → heritage_words, area_id uuid → areas)`: one row per unique area referenced by a word's entry (usages and examples). `word_id` is `ON DELETE CASCADE` (deleting a word drops its links); `area_id` is `ON DELETE RESTRICT` (an area referenced by a word cannot be deleted). RLS on; only `service_role` can read or write.
- `resolve_area_id(text) → uuid`: resolves an area id string — tries a direct UUID cast, then looks up `content_legacy_ids` for kind `area`. Returns null for unknown values (old admin writes with stale legacy keys are silently ignored).
- `word_entry_area_ids(jsonb) → uuid[]`: collects the distinct resolved area UUIDs from a word entry's `variants[].usages[].areaId` and `examples[].areaId`.
- `areas_hierarchy_jsonb(uuid[]) → jsonb`: builds the full ancestor hierarchy (via recursive CTE) for a set of area UUIDs in the public `Area` shape (`{ id, name, kind, parentId, externalIds? }`). Used for the dual-written `areas` column.
- `heritage_word_areas_project()` (`BEFORE INSERT OR UPDATE`) projects the legacy `areas` JSONB column from the `areas` table, while `heritage_word_areas_sync()` (`AFTER INSERT OR UPDATE`) syncs `heritage_word_areas`. Keeping projection in the original write avoids recursive updates and revision inflation. The column is kept until PR 14 so a rolled-back app renders correctly.
- `GET /api/review/areas` (reviewer only): returns all published areas ordered by kind then name, for the word-editor area picker.

**One-time backfill** (inside the migration): rewrites `variants[].usages[].areaId` and `examples[].areaId` in `heritage_words.entry` from legacy keys (e.g. `hr-kkz-krizevci`) to UUIDs via `content_legacy_ids`; rebuilds the `areas` JSONB column from the `areas` table; populates `heritage_word_areas`. Also rewrites `heritage_daily_words.village`, `snapshot.villageAreaId` and clue `areaIds` with the guard trigger disabled.

**WordEditor** replaces the raw JSON textarea with a `USelectMenu` populated from `GET /api/review/areas`. The `areas` column is projected by the trigger on save.

**Promotion** (`promoteSubmission`) no longer uses the hard-coded `PLACE_AREA_IDS` map; it queries `areas.geonames_id` for the submission's `place_id`. A case-insensitive exact name match on the submitted place is used only when no `place_id` was given, and only if it identifies exactly one published area.

Apply through the normal migration-first workflow. The previously deployed app keeps working: its inserts omit `heritage_word_areas` (the trigger fills it); its reads of the `areas` column still work (projected by trigger); old admin writes with legacy area keys are tolerated. After rollout, verify `select count(*) from public.heritage_word_areas;` is non-zero and no seeded word has legacy keys remaining in `entry`.

`node scripts/test-challenges.mjs` runs `test/wordAreas.integration.test.ts` on its disposable Postgres.

## Admin content API (no migration)

The content admin kit (`/api/admin/content/:kind`, first used by `/admin/izvori`) adds no migration. It reads and writes the content tables created by `20261103010000_content_tables.sql` (see Content tables above: `sources`, `heritage_item_sources`, `content_legacy_ids`, `content_revisions` and their triggers) through the same server-only service-role key as the other routes. Deploy it only after that migration is applied: until then the routes answer 503 `not-migrated` and change nothing, and the rest of the site is unaffected.

The database keeps the invariants, so direct SQL edits behave the same as admin edits:

- `content_before_write` bumps `revision`, sets `updated_at` and the folded `search_text`, and refuses a client-set revision or id change with `check_violation`, which the API maps to 400. The API updates with `revision = <expected>` and answers 409 when no row matched.
- `content_audit` writes every insert, update and delete to `content_revisions`. Requests through PostgREST cannot set the transaction setting `app.actor`, so their rows record the default actor `admin`. Seed migrations set `import`.
- Foreign keys with `on delete restrict` (for sources: `heritage_item_sources.source_id`) are the final guard against deleting a cited row. The API checks references first and maps a late `23503` to the same 409.

Rollback is app-only: the old app ignores these routes, and rows written through them stay valid content rows.

## Admin places (Mjesta, no migration)

`/admin/mjesta` (kind `area`) adds no migration. It reads and writes the `areas` table and `area_regions` from `20261103010000_content_tables.sql` and `20261103020000_seed_content.sql` through the generic content API. Region membership is edited as `regionIds` on the API and synced to `area_regions` after each save; history snapshots hold only the main row, so restoring an older revision does not roll back membership until a later save (the admin reloads membership on GET). Every write calls `invalidatePublicContent()` so atlas pages pick up hierarchy, slugs and region scope on the next request.

Deploy after the content seed migration is applied (503 `not-migrated` until then). `node scripts/test-challenges.mjs` runs `test/adminAreas.integration.test.ts` on its disposable Postgres: create with region membership, the `kind=lau` list filter, references and GET with `regionIds`.

## Change history (no migration)

The history screens (`/admin/povijest` and the drawer on every resource page) add no migration. They read `content_revisions` and write only through the content tables, so nothing new has to be deployed to the database and the previous app is unaffected. Deploy after `20261103010000_content_tables.sql` (the routes answer 503 `not-migrated` until then).

- Every audit row holds the full row (minus `search_text`) as `data`. The API compares consecutive snapshots of one `(entity_kind, entity_id)` in the order of `content_revisions_entity`, so no history table or column is added. A delete is recorded with revision `old.revision + 1`.
- Restoring updates the live row with `revision = <expected>` (or inserts it again if it was deleted) and lets the triggers do the rest, so the result is an ordinary `update` or `insert` revision by actor `admin`. A recreated row gets `revision = newest recorded revision + 1` and its original `created_at`, so the count never repeats and ordering by `id` stays the order of events. The history does not mark a revision as a restore; it shows what changed.
- A snapshot holds only the row. State kept in other tables (for example `heritage_item_sources`, `area_regions`) is not part of it, so a kind that edits such links needs them added to its registry definition before restore is complete for that kind.
- Rows of kinds without an admin resource yet are listed in the global log but cannot be opened or restored until their resource exists. Heritage categories and items are editable at `/admin/kategorije` and `/admin/bastina`; places at `/admin/mjesta`. Every save invalidates the public content snapshot.
- `content_revisions` is append-only for the app: nothing deletes or edits it. Contributor-credit redaction (a later plan step) will have to scrub the snapshots it appears in.

Rollback is app-only; the table and its rows stay.

## Corrections and proposals inbox rollout

`20261103110000_contributions_inbox.sql` is expand-only and sorts after every earlier migration (it needs `content_legacy_ids` and the content tables from `20261103010000_content_tables.sql`). Apply it before deploying the matching app. The previously deployed app ignores everything it adds, so migrating first is safe; roll back the app first and leave the columns.

What it adds:

- `heritage_submissions`: the `proposal` type, `target_kind` / `target_id`, `payload` (jsonb, at most 16 KiB), `base_revision`, `applied_at` / `applied_entity_id`, `credit_ref` and a duplicate `fingerprint`, with check constraints for the shape of a correction or proposal. Existing item corrections are backfilled (`target_kind = 'heritage_item'`, `target_id` resolved through `content_legacy_ids`; a correction whose item is gone keeps `target_id` null and its `target_ref`).
- `source_submission_id` on `heritage_items`, `areas` and `sources` (rows created from a proposal), next to the existing `heritage_words.submission_id`.
- Transient columns `apply_submission_id` / `apply_credit` and the `before insert or update` trigger `content_apply_submission()` on those tables and on words. A write that carries `apply_submission_id` is applied atomically: the trigger checks that the submission exists, is not rejected, has consent, is not applied yet and targets that row (a correction) or created it (a proposal), then sets `approved`, `applied_at`, `applied_entity_id`, adds the credit (a named, consenting contributor; sources carry none) and clears the transient columns. A failure rolls the whole write back, so an entity is never changed without its submission being marked applied, and a submission is never applied twice. Publishing a draft that has `source_submission_id` applies its proposal the same way. The function is revoked from public roles.
- `content_audit` now passes `app.submission_id` (`<entityId>:<submissionId>`), so the revision row of an applied change is attributed to the submission. The same attribution works for rows written through PostgREST, which cannot set session settings on their own.
- `heritage_submission_withdraw` (before delete, and on reject) now also unpublishes what a proposal created to draft and strips the credit, and `redact_submission_credit(submission_id)` (granted to `service_role` only) removes a credit entry from the live row and from every `content_revisions` snapshot of it. The withdrawal trigger calls it when a submission is deleted and when a proposal is rejected, so direct SQL deletes redact the same way. To remove a credit without deleting the submission, run `select public.redact_submission_credit(<id>);` as `service_role`.

The sidecar `heritage_item_sources` is not part of the atomic apply: correction payloads cannot change sources. `node scripts/test-challenges.mjs test/contentApply.integration.test.ts` proves the trigger in SQL and `test/adminInbox.integration.test.ts` the whole inbox flow on the disposable Postgres.

## Suggest dialogs on every page (no migration)

No migration and nothing to apply in production. The public suggestion forms (`HeritageSuggestDialog`, the `/doprinesi` cards) post to the existing `POST /api/submissions` and read two new public routes served from the snapshot store: `GET /api/content/suggest-options` and `GET /api/content/search`. The settlement page response gained `credits` and `updatedAt`, so the snapshot's area query now also selects the `credits` column that the inbox migration added. The privacy notice text is unchanged, so `PRIVACY_NOTICE_VERSION` stays as it is.

## Challenge templates

`20261103100000_challenge_templates.sql` moves the fixed challenge sets ("Izazov zavičaja") from `content/heritage/challenge.json` (now `test/fixtures/heritage/challenge.json`) into `heritage_challenge_templates`, edited at `/admin/izazovi`. It sorts after `20261103030000_word_admin_columns.sql` and uses the content-table helpers of `20261103010000_content_tables.sql`; if another migration lands first with a later timestamp, rename this file to sort after it before merging.

What it adds:

- `heritage_challenge_templates`: `name`, `content` (the challenge set: `sample`, `title`, `rounds`, without `version`), `is_current`, and the content-table conventions: UUID `id`, `status` (`draft`, `published`, `archived`), managed `revision`, `created_at`/`updated_at` and an accent-folded `search_text` from the name (`content_before_write('name')`). A check keeps the content's outline (an object with a boolean `sample`, a `title` object and 1–10 rounds, no `version` or `templateId`) and caps `content::text` at 256 KiB; the app validates the full shape with the same rules as the admin dialog.
- The "current" rules: at most one template is current (`heritage_challenge_templates_current`, a partial unique index) and it is published (`heritage_challenge_templates_current_published`). The `heritage_challenge_templates_current_rules` trigger makes a switch one statement: setting `is_current` on a template demotes the previous one first. It refuses, with Croatian messages the admin shows as they are, to switch the current template off, unpublish or archive it, or delete it, so new challenges always have one.
- History: `content_audit('challenge_template')` writes every insert, update and delete to `content_revisions` (`entity_kind = 'challenge_template'`), so the history drawer and restore work as for sources. A restore keeps the row's current `is_current`.
- RLS on, no grants for `public`, `anon` or `authenticated`, `service_role` only, like every other table.
- The seed: the sample set from `content/heritage/challenge.json` (now `test/fixtures/heritage/challenge.json`) as "Izazov zavičaja — uzorak", published and current, with id `content_uuid('challenge_template:sample')` in every environment and an `insert` revision by actor `import`. It is inserted only when that id is missing (not with `on conflict do nothing`, because the BEFORE trigger would demote the current template before a conflict is detected), and it is made current only when no template is current yet, so a replay changes nothing. `test/challengeTemplates.test.ts` (part of `pnpm test`) keeps the seed equal to the frozen JSON fixture.

A new fixed challenge copies the current template's content into `heritage_challenges.content`, with `version` set to the template's `revision` and `templateId` to its id. Existing challenges keep their snapshots and are never rewritten; quiz-result challenges do not use templates.

Apply it through the normal migration-first workflow. The previously deployed app still reads `content/heritage/challenge.json` and ignores the table, so migrating first is safe, and an app rollback keeps the table and its rows: do not drop it. Deploy the new app only after the migration: it reads the current template from the table, and until the table exists the challenge introduction and fixed-challenge creation answer 503 (joining and playing existing challenges are unaffected). After rollout, verify that `select name, status, is_current, revision from public.heritage_challenge_templates;` gives the one sample row (published, current, revision 1), that `anon` and `authenticated` get `permission denied`, and that a new fixed challenge's `content->>'templateId'` is that row's id.

`node scripts/test-challenges.mjs` runs `test/challengeTemplates.integration.test.ts` on its disposable Postgres: the seed and its import revision, the one-statement switch, the refusals for the current template (and the declarative checks without the trigger), the content outline and size checks, revision and search, public-role denial, the admin API (create, list, edit, conflict, archive, delete), and switching the current template through the API so that the next challenge uses it, plus a restore that keeps it current.

## Challenge question map display (WP15)

`20261104040000_challenge_question_display.sql` replaces `public.heritage_challenge_state` so the current question object includes `'display', q->'display'` when present in the challenge snapshot. Question bodies in `heritage_challenges.content` may already carry a `display` field (`map-target` or `map-points`); `heritage_challenge_questions` flattened them before, but the state RPC omitted them until this migration.

Rollout: migrate first. A previously deployed app ignores the extra key on the question object and keeps playing plain multiple-choice challenges. The new app treats a missing `display` as a text-only question. Existing snapshots without `display` are unchanged. Deploy the app only after the migration so map challenges receive coordinates during play. Merge this migration only on the captain's word (it replaces `heritage_challenge_state`).

## Retiring the content files (contract)

The last step of the content admin plan (PR 14) retires everything the database replaced. It ships one small migration and no destructive one.

**App side (no migration needed for it).** `content/atlas/*.json`, `content/heritage/*.json`, `scripts/import-atlas.mjs`, `scripts/generate-content-seed.mjs` (with `pnpm atlas:import` and `pnpm content:seed`), `shared/data/pzMunicipalities.ts`, the `pz.municipalities` labels in `i18n/locales/hr.json`, `HERITAGE_CATEGORY_LABELS` and `shared/utils/atlasData.ts` are deleted. The JSON that tests still compare the database with is frozen in `test/fixtures/` (`atlas/`: the five atlas files, the route list of the old prerendered site, the import report and the source dataset; `heritage/`: the sample words, word areas and challenge set). The drift test for the seed migration is gone with the generator.

- **Words read their areas from the `areas` table.** `server/utils/wordAreas.ts` builds the public `Area` list of an entry (the areas its usages and examples name, plus their ancestors) from `areas`. The public word list, the daily word and its admin, promotion and the admin content API (`/api/admin/content/word`) use it. The app no longer selects or writes `heritage_words.areas`, and the admin API derives a word's areas from its entry on the server instead of trusting what the dialog sends. The `areas` column stays up to date through `heritage_word_areas_project` until the contract migration below, which is what keeps an app from before this release rendering correctly after a rollback.
- **`target_ref` is no longer written or read.** `POST /api/submissions` takes a correction only as `targetKind` + `targetId` (an old atlas id is still accepted as `targetId`, and still resolves); the legacy `targetRef` form and the `SubmissionForm` correction props are gone. A cached client that still sends `targetRef` gets a 400 and has to reload.
- **`/api/review/words*` is retired** (404): nothing in the app used it, and words are written through `/api/admin/content/word`. `/api/review/submissions*`, `/api/review/daily*` and `/api/review/areas` stay.

**Migration `20261103130000_retire_target_ref_requirement.sql` (apply before deploying).** The app can only stop writing `target_ref` if the database stops requiring it: the check `heritage_submissions_correction_target_check` demanded `target_ref` on every correction. The migration replaces it with "only a correction may carry a `target_ref`". It loosens one constraint and touches no row, column, trigger or other constraint, so it is safe for every app version: the previous app keeps writing `target_ref` on corrections (allowed) and null elsewhere (allowed); the new app writes null. It is reversible: re-add the old check with `check ((type = 'correction' and target_ref is not null) or (type is distinct from 'correction' and target_ref is null))`, after setting `target_ref = target_id::text` on corrections that have none (`update public.heritage_submissions set target_ref = target_id::text where type = 'correction' and target_ref is null and target_id is not null;`; a UUID matches the format check). The state before the drop was checked by `test/contractRetire.integration.test.ts`, which `20261104060000_drop_retired_columns.sql` made obsolete (see below).

**Why the columns are not dropped in the same release.** Production applies migrations before it promotes the new app, and the hosting build can lag or fail. The app live at that moment (`main` at `1d42ff9`) still selects `heritage_words.areas` (the public word list, the daily word, the daily admin) and still inserts `target_ref` on every submission. Dropping either column in the same deploy would break that app between the migration and the promotion, and rolling back to it afterwards. So the drop is a separate, later migration.

### Applied contract migration: `20261104060000_drop_retired_columns.sql`

This is the destructive follow-up the previous section announced. Nothing reads `heritage_words.areas` or writes `heritage_submissions.target_ref` any more (the release above shipped on 2026-11-03 and the rollback window has passed), so the migration drops both columns:

- `heritage_words`: drops the trigger `heritage_word_areas_project`, the functions `heritage_word_areas_project()` and `areas_hierarchy_jsonb(uuid[])` and the column `areas`, and re-creates `heritage_word_payload_size` (`octet_length(entry::text) <= 131072`) on `entry` only, because the old check measured the column too and a column drop would otherwise remove it silently.
- `heritage_submissions`: drops `heritage_submissions_correction_target_check`, `heritage_submissions_target_ref_format_check` and the column `target_ref`.
- Untouched: `resolve_area_id`, `word_entry_area_ids`, the `heritage_word_areas_sync` trigger and the `heritage_word_areas` table.

**Rollout notes.** It permanently deletes the data in `heritage_words.areas` (a derived copy; the same areas are recomputed from `entry` and the `areas` table) and in `heritage_submissions.target_ref` (the legacy id of corrections). **Before applying it to production**, check that no correction depends on the column alone: `select id, target_ref from public.heritage_submissions where type = 'correction' and target_id is null;`. Those are corrections whose item was already gone when `20261103110000_contributions_inbox.sql` backfilled `target_id`; the drop would erase the only record of which item they were about. Copy them somewhere (or into `payload`) first. Take a backup with `supabase db dump --linked` as well; free projects have no point-in-time recovery. The drop is not reversible in place: afterwards the only way back is a restore from that backup, and an app older than the release above cannot run against the new schema. `content_revisions` snapshots of words keep their historical `areas` JSON; the admin ignores it.

`test/contractMigration.integration.test.ts` (part of `node scripts/test-challenges.mjs`) checks the applied schema on disposable Postgres: both columns, the trigger, the two functions and the two submission checks are gone, `resolve_area_id`, `word_entry_area_ids`, `heritage_word_areas_sync` and `heritage_word_areas` remain, `heritage_word_payload_size` measures `entry` only, a word's usage link is still kept and a correction without `target_ref` is accepted. The earlier `test/contractRetire.integration.test.ts` (the state before the drop) was removed.

## Public read layer

No migration. The public atlas API (`/api/atlas/*`, `/api/content/target`) and the database sitemap route read the content tables through one in-process snapshot (`server/utils/publicContent.ts`): published and archived rows of `areas` (region, towns, municipalities, settlements), `area_regions`, `heritage_categories`, `heritage_items`, `sources` and `heritage_item_sources`, and the `area`, `heritage_item`, `heritage_category` and `source` rows of `content_legacy_ids` and `content_slug_history`. It reads as `service_role`, like every other server query, so RLS and grants are unchanged. Draft rows are never read.

Nothing needs applying in production beyond the content migrations already on main. Deploying this step switches atlas pages, the sitemap and correction-target validation to the database snapshot. From then on a cold start with the database unreachable answers 503 on those routes, while a running process keeps serving its last good snapshot until the 60 s TTL retries. Schedule a daily keep-alive ping on Supabase free tier so the atlas stays reachable.

`node scripts/test-challenges.mjs` also runs `test/publicContent.integration.test.ts` and `test/atlasPages.integration.test.ts`: the whole imported atlas through the snapshot (every town, municipality, settlement and item, field by field, and old item ids with and without diacritics), every atlas route of `content/atlas/prerender-routes.json`, sitemap URL parity with the snapshot builder, warm-snapshot latency on Postgres, and, on its own region, renames, item moves, archiving, drafts, region membership and invalidation after a write. The default `pnpm test` suite covers atlas SSR route parity, SEO on sample pages, the prerender guard and the fake-database snapshot used in CI.

## Failure and recovery

Open **GitHub → Actions → Production database and deploy → failing run → Migrate then promote production branch**. The history step shows version numbers, and the Supabase CLI reports the failed migration and database error. Missing baseline entries, unknown remote migrations, missing earlier versions, authentication/connection errors, SQL errors, branch divergence, or branch protection failures stop the job. Subsequent branch promotion is skipped on migration failure; `production` remains at its last promoted commit.

The dry run prevents history disagreements from applying an early subset of pending files. An SQL failure during the real push can still leave earlier migrations from that push committed; this is not a transaction across all files. Inspect `supabase migration list --linked` and the actual schema before retrying. Fix the underlying issue with a reviewed migration or an accurate, manually verified history repair; never blindly mark a failed migration applied. Avoid changing already applied migration files. Re-run the workflow for the latest `main` after fixing the issue. If a stale run was skipped, verify the newest run succeeded, or manually dispatch on `main`.

If migration succeeded but promotion was rejected, correct branch permissions/divergence and retry: already tracked migrations are skipped. If promotion succeeded but Hostinger failed to build, fix the build or redeploy the same `production` commit in Hostinger. The workflow does not automatically roll back schema or app code. Inspect any rollback for schema compatibility.

## Persons content (WP17)

`20261104010000_persons.sql` adds the `persons` table and sidecars `person_areas`, `person_heritage_items` and `person_sources`, widens `content_legacy_ids`, `content_slug_history` and `heritage_submissions.target_kind` to accept kind `person`, and wires audit, slug history and proposal apply/withdraw like other content rows. Apply before deploying the matching app. The previously deployed app ignores the tables; nothing reads them until WP18 ships public pages. After rollout, verify `\dt public.person*` lists four tables with RLS enabled and that `anon` gets `permission denied`.

## Persons seed (WP19)

`20261104050000_seed_persons.sql` inserts six published persons (Marko Križevčanin, Ivan Vitez od Sredne, Antun Nemčić, Sidonija Erdődy Rubido, Vladimir Srećko Vrkljan, Zlatko Špoljar), six sources (five hr.wikipedia articles and one Hrčak publication), area and heritage links, and `person_sources` rows. Every insert uses `on conflict do nothing`, so replay is safe. Area and item foreign keys use subselects by slug; a missing slug fails the migration. Apply before deploying the matching app so `/osobe`, the Learn person cards and the "Tko je to?" game can go live.

`node scripts/test-challenges.mjs test/seedPersons.integration.test.ts` replays the seed on disposable Postgres and checks row counts and link resolution.

## Clubs content (WP20)

`20261104020000_clubs.sql` adds `clubs` (name, slug, full name, sport, settlement, optional founded year and home ground, verification, credits, status), `club_seasons` (club, season matching `YYYY/YY`, competition, team, source URL, checked_at; unique per club, season and team) and `club_sources`. It widens the same kind checks to accept `club`, updates `heritage_submission_withdraw` and `redact_submission_credit` for club rows, and enables RLS with service_role-only access on all three tables. Publishing requires at least one source (enforced in the kind handler). `20261104030000_seed_clubs.sql` imports the 25 clubs from the ksh-clubs-research deliverable (replay-safe `on conflict do nothing`), with 13 verified 2026/27 season rows; NK Kalnik is seeded without a current league season.

Apply both migrations before deploying the matching app. The public snapshot loads published clubs whose settlement is live; the Learn card pool exposes topic `sport` when at least eight club cards exist. Challenge games `klub-mjesto`, `klub-liga` and `klub-odakle` always name the season in league prompts. The admin page `/admin/klubovi` shows an August reminder to refresh season facts.

`node scripts/test-challenges.mjs test/clubs.integration.test.ts` exercises the API, seed replay and RLS on disposable Postgres; `test/clubQuestions.test.ts` covers validators and question copy.

## Manual fallback

Keep Hostinger auto-deployment **off** throughout this procedure. Do the baseline verification above first. In a checkout of the exact commit to deploy, link and review history and the pending plan:

```bash
supabase link --project-ref <production-project-ref>
supabase migration list --linked
supabase db push --linked --dry-run --skip-vault
supabase db push --linked --skip-vault
```

Only after all commands succeed, fast-forward `production` to that exact commit without force (`git push origin <verified-commit-sha>:refs/heads/production`) and redeploy that branch in Hostinger. Verify Hostinger's deployed SHA and test the form and review page. If branch selection is unavailable, manually deploy/upload only the verified commit with automatic deployment disabled. Running migration SQL in SQL Editor is also possible, but afterward record only those successfully applied versions with `supabase migration repair --linked --status applied <version>` and inspect `migration list` before enabling automation again.
