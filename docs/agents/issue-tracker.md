# Issue tracker: Gitea

Issues and specs for this repo live as issues on the self-hosted Gitea server at `https://git.asus.local/ksiladi/karlo-siladi-from-hr`. Use the `tea` CLI for all operations; `gh` and `glab` cannot reach this host. `tea` infers the repo from `git remote -v` when run inside the clone; pass `--repo ksiladi/karlo-siladi-from-hr` if it doesn't.

## Conventions

- **Create an issue**: `tea issues create --title "..." --description "..." [--labels a,b]`. Use a heredoc (`--description "$(cat <<'MD' ... MD)"`) for multi-line bodies.
- **Read an issue**: `tea issues <number> --comments`. For JSON: `tea api repos/{owner}/{repo}/issues/<number>` and `tea api repos/{owner}/{repo}/issues/<number>/comments`.
- **List issues**: `tea issues list --state open --output json [--labels <label>]`.
- **Parent / child**: Gitea has no sub-issues. Put `Part of #<parent>` at the top of the child body, and add the child to a task list (`- [ ] #<child>`) in the parent body.
- **Blocking**: Gitea's **native issue dependencies**, the UI-visible representation. Add an edge with `tea api -X POST repos/{owner}/{repo}/issues/<child>/dependencies -d '{"owner":"ksiladi","repo":"karlo-siladi-from-hr","index":<blocker>}'`. If dependencies are unavailable, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Count open blockers**: `tea api repos/{owner}/{repo}/issues/<n>/dependencies` lists blockers including closed ones; count only entries with `"state": "open"` (0 means startable).
- **Comment on an issue**: `tea comment <number> "..."`
- **Apply / remove labels**: `tea issues edit <number> --add-labels "..."` / `--remove-labels "..."`
- **Close**: post the explanation with `tea comment <number> "..."`, then `tea issues close <number>`.

If a `tea` subcommand or flag is missing in the installed version, fall back to `tea api` against the Gitea REST API (`/api/v1/repos/ksiladi/karlo-siladi-from-hr/...`).

File issues only into `ksiladi/karlo-siladi-from-hr`. Never file into `mattpocock/skills` (the repo these skills come from).

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `tea pulls` equivalents (`tea pulls <n>`, `tea pulls list`, `tea comment <n>`, `tea pulls close <n>`); for diffs use `tea api repos/{owner}/{repo}/pulls/<n>.diff`.

Gitea shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `tea pulls 42` and fall back to `tea issues 42`.

## When a skill says "publish to the issue tracker"

Create a Gitea issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `tea issues create --labels wayfinder:map ...`.
- **Child ticket**: an issue linked to the map per **Parent / child** above (task list in the map body, `Part of #<map>` in the child). Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: see **Blocking** under Conventions.
- **Frontier query**: list the map's open children (the task list in the map body), drop any with an open blocker (see **Count open blockers**, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `tea issues edit <n> --add-assignees ksiladi`, the session's first write.
- **Resolve**: `tea comment <n> "<answer>"`, then `tea issues close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
