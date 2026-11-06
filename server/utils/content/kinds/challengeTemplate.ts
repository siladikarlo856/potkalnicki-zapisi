import { CHALLENGE_LIMITS, validateChallengeTemplate } from '../../../../shared/utils/content/challengeTemplate'
import { invalidateCurrentChallengeContent } from '../../../challenges'
import { defineContentKind } from '../definition'

// Challenge templates (Izazovi). Nothing refers to a template: every challenge keeps its own
// snapshot. The database keeps the "current" rules (20261103100000_challenge_templates.sql): making a
// template current demotes the previous one in the same statement, and the current template can
// be neither unpublished, archived, deleted nor switched off, so the game always has one. Its
// refusals are Croatian messages that the store passes to the admin as they are.
export const challengeTemplateKind = defineContentKind({
  kind: 'challenge_template',
  table: 'heritage_challenge_templates',
  fields: { name: 'name', content: 'content', isCurrent: 'is_current' },
  labelColumn: 'name',
  validate: validateChallengeTemplate,
  sorts: { name: 'name', isCurrent: 'is_current' },
  defaultSort: 'name',
  filters: {},
  uniqueConstraints: { heritage_challenge_templates_current: 'isCurrent' },
  // Restoring an older version changes the questions, never which template is current.
  restoreKeeps: ['isCurrent'],
  // A save can change which template new challenges use.
  afterWrite: invalidateCurrentChallengeContent,
  bodyLimit: CHALLENGE_LIMITS.bodyBytes
})
