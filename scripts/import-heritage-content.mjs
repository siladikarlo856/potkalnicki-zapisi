#!/usr/bin/env node
// Imports the reviewed heritage content (descriptions, sources, registry numbers, research notes and Commons
// photos with their credit) into a running site through its admin API. See data/heritage-content/README.md.
//
//   read -rs NUXT_REVIEW_SECRET && export NUXT_REVIEW_SECRET
//   node scripts/import-heritage-content.mjs --base https://karlo-siladi.from.hr            # dry run
//   node scripts/import-heritage-content.mjs --base https://karlo-siladi.from.hr --apply    # import
//
// Options: --dry-run (the default), --apply, --only <settlement-slug/item-slug>, --dataset <path>.
// The secret is read from the environment only, never from an argument, so it stays out of the process list.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { ImportError, runImport } from './heritage-content/run.mjs'

const { values } = parseArgs({
  options: {
    'base': { type: 'string' },
    'apply': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'only': { type: 'string' },
    'dataset': { type: 'string', default: fileURLToPath(new URL('../data/heritage-content/churches.json', import.meta.url)) },
    'help': { type: 'boolean', default: false }
  }
})

if (values.help || !values.base) {
  console.log('Usage: node scripts/import-heritage-content.mjs --base <site URL> [--dry-run | --apply] [--only <settlement/slug>] [--dataset <file>]\nThe review password is read from the NUXT_REVIEW_SECRET environment variable.')
  process.exit(values.help ? 0 : 2)
}
if (values.apply && values['dry-run']) {
  console.error('Choose either --dry-run or --apply.')
  process.exit(2)
}

try {
  const dataset = JSON.parse(readFileSync(values.dataset, 'utf8'))
  const { report } = await runImport({
    dataset,
    base: values.base,
    secret: process.env.NUXT_REVIEW_SECRET ?? '',
    apply: values.apply,
    only: values.only ?? null,
    log: line => console.log(line)
  })
  process.exitCode = report.some(entry => entry.status === 'failed' || entry.status === 'not found') ? 1 : 0
} catch (error) {
  console.error(error instanceof ImportError ? error.message : error)
  process.exitCode = 1
}
