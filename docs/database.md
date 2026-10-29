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
