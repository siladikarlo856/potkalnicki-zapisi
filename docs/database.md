# Database migrations and production rollout

Schema changes live in `supabase/migrations/`. Add a new timestamped SQL file for each change; do not edit a migration that has already been applied. Keep migrations compatible with the currently running app: the database changes before Hostinger builds the new app. The Supabase CLI tracks applied versions in `supabase_migrations.schema_migrations`; SQL Editor does not populate this history automatically.

Supabase's [migration guide](https://supabase.com/docs/guides/deployment/database-migrations) and [CLI reference](https://supabase.com/docs/reference/cli/global-flags) explain history repair and dry runs. History checks compare version numbers; they do not detect every manual schema edit or changes to an already applied SQL file.

## One-time production setup (owner)

Do this before merging app changes that require a new schema. These commands are production operations for the owner to run; CI does not repair history automatically.

1. Turn off the Node.js app's automatic deployment from `main` in Hostinger before proceeding. Keep the currently deployed app running.
2. Install **Supabase CLI 2.122.0** (the version pinned in `.github/workflows/production.yml`). In a checkout of the latest `main`, authenticate and inspect history:

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

   These are GitHub Actions secrets, separate from the app's Hostinger runtime variables. No production credentials are used on pull requests. If any secret is absent, the production job exits successfully with a **Production rollout skipped** notice, without linking, migrating, or promoting a branch. A green workflow with this notice is not a completed rollout.
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

`20261102100000_submission_corrections.sql` adds the `correction` submission type and nullable `target_ref` (atlas item id). It sorts after the seed migrations and does not change word tables or triggers. The constraint requires `target_ref` when `type = 'correction'` and forbids it on other types. Legacy rows keep null `target_ref` and their existing types.

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

`20261103010000_content_tables.sql` creates the database home for the atlas content that is still read from `content/atlas/*.json` today. It is the first step of the content admin plan: nothing reads these tables yet, and the rows arrive in the [atlas content import](#atlas-content-import), so the tables start empty. The version sorts after every migration on `main` and after `20261103000000_submission_word_link.sql`; if another migration lands first with a later timestamp, rename this file to sort after it before merging.

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

`20261103020000_seed_content.sql` imports the atlas into the content tables once. It sorts after `20261103010000_content_tables.sql`, which it fills; if another migration lands first with a later timestamp, rename this file to sort after it before merging (the generator and the drift test find it by its `_seed_content.sql` suffix).

What it inserts, all with `status = 'published'`:

- `areas`: Hrvatska (country) and Koprivničko-križevačka županija (county), from the word-area keys in `content/heritage/areas.json`; the region Potkalničko prigorje (slug `potkalnicko-prigorje`) below the county; Križevci as a `town` and Kalnik, Gornja Rijeka, Sveti Petar Orehovec and Sveti Ivan Žabno as `municipality` rows below the county, with today's slugs (`grad-krizevci`, `opcina-kalnik`, …). The stored name is the bare place name; "Grad"/"Općina" comes from the kind, which reproduces today's labels. Then the 135 settlements from `content/atlas/settlements.json` below their town or municipality, with the DGU code as `official_code`, the centroid and the `geonames_id` of the one active place-catalog entry with that code (`server/data/places/hr.json`).
- `area_regions`: the five towns and municipalities as members of Potkalničko prigorje.
- `heritage_categories`: the 10 dataset categories with today's Croatian labels and sort order (`monastery` is defined but unused); English labels are left empty.
- `sources`: the 10 sources.
- `heritage_items`: the 107 items of `content/atlas/heritage.json` with the same name, slug, category, municipality, settlement (12 have none), locality, `verification` (from `status`), research notes and `noindex`; `dataset_id` is the dataset record id. From the source dataset (`data/heritage/…json`) they also get `period` (7 items), `registry_number` (19) and `heritage_status` (100 `needs_verification`, 7 `historical_site`); description and coordinates are empty there, so they stay null.
- `heritage_item_sources`: 137 links, in the item's source order.
- `content_legacy_ids`: every import key, plus `hr-kkz-krizevci` and `hr-kkz-sveti-petar-orehovec` (the word usages' town and municipality keys, mapped to the same rows as `krizevci` and `svetiPetarOrehovec`) and the 55 dataset item ids with diacritics (`križevci-crkva-sv-ane`).

Ids are deterministic: `content_uuid('<kind>:<import key>')`, where the import key is the pre-UUID id (`area:hr`, `area:krizevci`, `area:000299` for a settlement's DGU code, `heritage_category:church`, `source:registar-kulturnih-dobara`, `heritage_item:krizevci-crkva-sv-ane`). Local, CI and production therefore hold the same ids, and code and tests can compute them. The file runs in one transaction with `set local app.actor = 'import'`, so the content triggers write one `insert` revision per row with actor `import`. Words are not part of the import: they are already in `heritage_words`.

`scripts/generate-content-seed.mjs` renders the file from `content/atlas/*.json`, `content/heritage/areas.json`, the source dataset and the place catalog, and stops on any inconsistency (an unknown settlement, source or category, a settlement outside its item's municipality, a missing or ambiguous catalog entry). `test/contentSeed.test.ts` (part of `pnpm test`) fails when the committed file differs from what the generator renders, which keeps the JSON frozen while it still exists. Once merged the migration is applied and must not change: content edits go into the database, not the JSON. `node scripts/test-challenges.mjs` also runs `test/contentSeed.integration.test.ts` on its disposable Postgres: every imported row field by field against the content files, the counts (5 towns and municipalities, 135 settlements, 10 categories, 10 sources, 107 items), legacy-id resolution, deterministic ids, the import revisions, and that replaying the file changes nothing.

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

`node scripts/test-challenges.mjs` runs `test/wordColumns.integration.test.ts` on its disposable Postgres: the backfilled slugs and baseline revisions of the seeded words, the id check (text, uppercase and suffixed ids refused), `content_slug` against `atlasSlug`, homograph suffixes and slug stability, revision and stale-update refusal, history rows (deletes included), archiving, slug history and the previous app's insert and update.

## Admin content API (no migration)

The content admin kit (`/api/admin/content/:kind`, first used by `/admin/izvori`) adds no migration. It reads and writes the content tables created by `20261103010000_content_tables.sql` (see Content tables above: `sources`, `heritage_item_sources`, `content_legacy_ids`, `content_revisions` and their triggers) through the same server-only service-role key as the other routes. Deploy it only after that migration is applied: until then the routes answer 503 `not-migrated` and change nothing, and the rest of the site is unaffected.

The database keeps the invariants, so direct SQL edits behave the same as admin edits:

- `content_before_write` bumps `revision`, sets `updated_at` and the folded `search_text`, and refuses a client-set revision or id change with `check_violation`, which the API maps to 400. The API updates with `revision = <expected>` and answers 409 when no row matched.
- `content_audit` writes every insert, update and delete to `content_revisions`. Requests through PostgREST cannot set the transaction setting `app.actor`, so their rows record the default actor `admin`. Seed migrations set `import`.
- Foreign keys with `on delete restrict` (for sources: `heritage_item_sources.source_id`) are the final guard against deleting a cited row. The API checks references first and maps a late `23503` to the same 409.

Rollback is app-only: the old app ignores these routes, and rows written through them stay valid content rows.

## Change history (no migration)

The history screens (`/admin/povijest` and the drawer on every resource page) add no migration. They read `content_revisions` and write only through the content tables, so nothing new has to be deployed to the database and the previous app is unaffected. Deploy after `20261103010000_content_tables.sql` (the routes answer 503 `not-migrated` until then).

- Every audit row holds the full row (minus `search_text`) as `data`. The API compares consecutive snapshots of one `(entity_kind, entity_id)` in the order of `content_revisions_entity`, so no history table or column is added. A delete is recorded with revision `old.revision + 1`.
- Restoring updates the live row with `revision = <expected>` (or inserts it again if it was deleted) and lets the triggers do the rest, so the result is an ordinary `update` or `insert` revision by actor `admin`. A recreated row gets `revision = newest recorded revision + 1` and its original `created_at`, so the count never repeats and ordering by `id` stays the order of events. The history does not mark a revision as a restore; it shows what changed.
- A snapshot holds only the row. State kept in other tables (for example `heritage_item_sources`, `area_regions`) is not part of it, so a kind that edits such links needs them added to its registry definition before restore is complete for that kind.
- Rows of kinds without an admin resource yet (`word`, `area`, `heritage_item`, `heritage_category`, including the `import` baselines) are listed in the global log but cannot be opened or restored.
- `content_revisions` is append-only for the app: nothing deletes or edits it. Contributor-credit redaction (a later plan step) will have to scrub the snapshots it appears in.

Rollback is app-only; the table and its rows stay.

## Failure and recovery

Open **GitHub → Actions → Production database and deploy → failing run → Migrate then promote production branch**. The history step shows version numbers, and the Supabase CLI reports the failed migration and database error. Missing baseline entries, unknown remote migrations, missing earlier versions, authentication/connection errors, SQL errors, branch divergence, or branch protection failures stop the job. Subsequent branch promotion is skipped on migration failure; `production` remains at its last promoted commit.

The dry run prevents history disagreements from applying an early subset of pending files. An SQL failure during the real push can still leave earlier migrations from that push committed; this is not a transaction across all files. Inspect `supabase migration list --linked` and the actual schema before retrying. Fix the underlying issue with a reviewed migration or an accurate, manually verified history repair; never blindly mark a failed migration applied. Avoid changing already applied migration files. Re-run the workflow for the latest `main` after fixing the issue. If a stale run was skipped, verify the newest run succeeded, or manually dispatch on `main`.

If migration succeeded but promotion was rejected, correct branch permissions/divergence and retry: already tracked migrations are skipped. If promotion succeeded but Hostinger failed to build, fix the build or redeploy the same `production` commit in Hostinger. The workflow does not automatically roll back schema or app code. Inspect any rollback for schema compatibility.

## Manual fallback

Keep Hostinger auto-deployment **off** throughout this procedure. Do the baseline verification above first. In a checkout of the exact commit to deploy, link and review history and the pending plan:

```bash
supabase link --project-ref <production-project-ref>
supabase migration list --linked
supabase db push --linked --dry-run --skip-vault
supabase db push --linked --skip-vault
```

Only after all commands succeed, fast-forward `production` to that exact commit without force (`git push origin <verified-commit-sha>:refs/heads/production`) and redeploy that branch in Hostinger. Verify Hostinger's deployed SHA and test the form and review page. If branch selection is unavailable, manually deploy/upload only the verified commit with automatic deployment disabled. Running migration SQL in SQL Editor is also possible, but afterward record only those successfully applied versions with `supabase migration repair --linked --status applied <version>` and inspect `migration list` before enabling automation again.
