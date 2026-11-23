#!/usr/bin/env bash
# Publish the migrated commit to the GitHub `production` branch that Hostinger builds from.
#
# The Forgejo history contains Playwright binaries over GitHub's 100 MB limit, so Forgejo cannot
# push to GitHub. Instead this adds ONE flattened commit on top of the current GitHub production
# head: its tree is exactly the migrated commit's tree. The push is an ordinary fast-forward and is
# never forced; GitHub rejects it if another writer moved the branch first.
#
# Environment:
#   GH_DEPLOY_TOKEN   GitHub token with write access to the repository contents. Absent: skip.
#   GH_DEPLOY_REPO    owner/name of the GitHub repository.
#   DEPLOY_SHA        The migrated commit to publish (the workflow passes $GITHUB_SHA).
#   GH_DEPLOY_URL     Optional remote URL override (tests); defaults to the GitHub HTTPS URL.
set -euo pipefail

notice() { echo "::notice::$*"; }
fail() { echo "::error::$*" >&2; exit 1; }

if [[ -z "${GH_DEPLOY_TOKEN:-}" ]]; then
  notice "GitHub deploy skipped: add the GH_DEPLOY_TOKEN Actions secret (GitHub token with Contents read/write on ${GH_DEPLOY_REPO:-the GitHub repository}). Forgejo production was advanced, but Hostinger builds from GitHub, so the live site did not change."
  exit 0
fi

repo="${GH_DEPLOY_REPO:?GH_DEPLOY_REPO is required}"
sha="${DEPLOY_SHA:?DEPLOY_SHA is required}"
url="${GH_DEPLOY_URL:-https://github.com/${repo}.git}"
branch="production"

echo "::add-mask::${GH_DEPLOY_TOKEN}"
# Send the token only to the GitHub host, and never put it in a URL, the process list or the git config.
auth="$(printf 'x-access-token:%s' "$GH_DEPLOY_TOKEN" | base64 | tr -d '\n')"
echo "::add-mask::${auth}"
export GIT_TERMINAL_PROMPT=0
export GIT_CONFIG_COUNT=1
export GIT_CONFIG_KEY_0="http.https://github.com/.extraheader"
export GIT_CONFIG_VALUE_0="AUTHORIZATION: basic ${auth}"

migrated_tree="$(git rev-parse --verify "${sha}^{tree}")"

# Resolve the current GitHub production head, then fetch just that commit to use as the parent.
head="$(git ls-remote "$url" "refs/heads/${branch}" | awk 'NR == 1 { print $1 }')"
if [[ -z "$head" ]]; then
  fail "GitHub has no ${branch} branch (or the token cannot read it). Create it at the live commit first; this step never creates the branch."
fi
git fetch --no-tags --depth=1 "$url" "$head"

if [[ "$(git rev-parse --verify "${head}^{tree}")" == "$migrated_tree" ]]; then
  notice "GitHub ${branch} (${head}) already has the tree of ${sha}. Nothing to publish."
  exit 0
fi

deploy="$(
  GIT_AUTHOR_NAME="Production deploy" GIT_AUTHOR_EMAIL="deploy@git.asus.local" \
  GIT_COMMITTER_NAME="Production deploy" GIT_COMMITTER_EMAIL="deploy@git.asus.local" \
    git commit-tree "$migrated_tree" -p "$head" \
      -m "Deploy ${sha}" \
      -m "Flattened deploy commit: the tree is exactly that of ${sha}, which is migrated and on Forgejo production."
)"
if [[ "$(git rev-parse --verify "${deploy}^{tree}")" != "$migrated_tree" ]]; then
  fail "Deploy commit ${deploy} does not carry the tree of ${sha}."
fi

# Fast-forward only: no --force, no leading '+'. A raced branch makes this fail instead of overwriting.
git push "$url" "${deploy}:refs/heads/${branch}"
notice "GitHub ${branch} advanced from ${head} to ${deploy}, which carries the tree of ${sha}. Check Hostinger's deployment log for the app build result."
