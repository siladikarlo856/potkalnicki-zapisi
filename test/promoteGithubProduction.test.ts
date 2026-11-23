import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const script = join(process.cwd(), 'scripts/promote-github-production.sh')
const identity = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com']

let dir: string

function git(cwd: string, ...args: string[]) {
  return execFileSync('git', [...identity, ...args], { cwd, encoding: 'utf8' }).trim()
}

function commitFile(cwd: string, name: string, content: string, message: string) {
  writeFileSync(join(cwd, name), content)
  git(cwd, 'add', name)
  git(cwd, 'commit', '-m', message)
  return git(cwd, 'rev-parse', 'HEAD')
}

function run(env: Record<string, string | undefined>, cwd: string) {
  return spawnSync('bash', [script], {
    cwd,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: dir, GIT_CONFIG_NOSYSTEM: '1', ...env }
  })
}

// Forgejo's history (main) and GitHub's older, unrelated production history, as in production.
let work: string
let remote: string
let githubHead: string
let migrated: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'promote-github-'))
  remote = join(dir, 'github.git')
  work = join(dir, 'work')

  // GitHub: a production branch with its own history.
  const seed = join(dir, 'seed')
  git(dir, 'init', '-q', '-b', 'production', seed)
  commitFile(seed, 'a.txt', 'old', 'old live commit')
  githubHead = commitFile(seed, 'b.txt', 'old b', 'live commit')
  git(dir, 'clone', '-q', '--bare', seed, remote)

  // Forgejo: main with a different history (it never shared commits with the GitHub branch).
  git(dir, 'init', '-q', '-b', 'main', work)
  commitFile(work, 'a.txt', 'one', 'first')
  migrated = commitFile(work, 'c.txt', 'two', 'migrated')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const base = () => ({ GH_DEPLOY_REPO: 'owner/repo', DEPLOY_SHA: migrated, GH_DEPLOY_URL: remote })

describe('promote-github-production.sh', () => {
  it('skips with a notice, touching nothing, when the token secret is absent', () => {
    const result = run({ ...base(), GH_DEPLOY_TOKEN: '' }, work)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('::notice::GitHub deploy skipped')
    expect(result.stdout).toContain('GH_DEPLOY_TOKEN')
    expect(git(remote, 'rev-parse', 'production')).toBe(githubHead)
  })

  it('adds one flattened commit: parent is the GitHub head, tree is the migrated commit tree', () => {
    const result = run({ ...base(), GH_DEPLOY_TOKEN: 'ghp_secret_value' }, work)
    expect(result.status, result.stderr).toBe(0)
    // Only the runner's ::add-mask:: command may carry the value; it hides it from the log.
    const visible = (result.stdout + result.stderr).split('\n').filter(line => !line.startsWith('::add-mask::'))
    expect(visible.join('\n')).not.toContain('ghp_secret_value')

    const deployed = git(remote, 'rev-parse', 'production')
    expect(deployed).not.toBe(githubHead)
    expect(git(remote, 'rev-parse', `${deployed}^`)).toBe(githubHead)
    expect(git(remote, 'rev-parse', `${deployed}^{tree}`)).toBe(git(work, 'rev-parse', `${migrated}^{tree}`))
    expect(git(remote, 'rev-list', '--count', `${githubHead}..${deployed}`)).toBe('1')
    expect(result.stdout).toContain(`::notice::GitHub production advanced from ${githubHead} to ${deployed}`)
  })

  it('does nothing on a re-run once the tree is already published', () => {
    expect(run({ ...base(), GH_DEPLOY_TOKEN: 't' }, work).status).toBe(0)
    const deployed = git(remote, 'rev-parse', 'production')
    const again = run({ ...base(), GH_DEPLOY_TOKEN: 't' }, work)
    expect(again.status).toBe(0)
    expect(again.stdout).toContain('Nothing to publish')
    expect(git(remote, 'rev-parse', 'production')).toBe(deployed)
  })

  it('stacks deploys: the next deploy has the previous deploy commit as its parent', () => {
    expect(run({ ...base(), GH_DEPLOY_TOKEN: 't' }, work).status).toBe(0)
    const first = git(remote, 'rev-parse', 'production')
    const next = commitFile(work, 'd.txt', 'three', 'next')
    expect(run({ ...base(), DEPLOY_SHA: next, GH_DEPLOY_TOKEN: 't' }, work).status).toBe(0)
    const second = git(remote, 'rev-parse', 'production')
    expect(git(remote, 'rev-parse', `${second}^`)).toBe(first)
    expect(git(remote, 'rev-parse', `${second}^{tree}`)).toBe(git(work, 'rev-parse', `${next}^{tree}`))
  })

  it('fails without creating the branch when GitHub has no production branch', () => {
    git(remote, 'branch', '-m', 'production', 'other')
    const result = run({ ...base(), GH_DEPLOY_TOKEN: 't' }, work)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('::error::GitHub has no production branch')
    expect(git(remote, 'branch', '--list', 'production')).toBe('')
  })

  it('never forces the push: a production branch moved by another writer during the push stays put', () => {
    const seed = join(dir, 'seed')
    const raced = commitFile(seed, 'race.txt', 'raced', 'another writer')
    git(seed, 'push', '-q', remote, `${raced}:refs/heads/race`)

    const realGit = execFileSync('bash', ['-c', 'command -v git'], { encoding: 'utf8' }).trim()
    const shimDir = join(dir, 'shim')
    mkdirSync(shimDir)
    writeFileSync(
      join(shimDir, 'git'),
      [
        '#!/usr/bin/env bash',
        'for arg in "$@"; do',
        '  if [[ "$arg" == push ]]; then',
        `    "${realGit}" --git-dir="${remote}" update-ref refs/heads/production "${raced}"`,
        '    break',
        '  fi',
        'done',
        `exec "${realGit}" "$@"`,
        ''
      ].join('\n'),
      { mode: 0o755 }
    )

    const result = run({ ...base(), GH_DEPLOY_TOKEN: 't', PATH: `${shimDir}:${process.env.PATH}` }, work)
    expect(result.status).not.toBe(0)
    expect(git(remote, 'rev-parse', 'production')).toBe(raced)
  })
})
