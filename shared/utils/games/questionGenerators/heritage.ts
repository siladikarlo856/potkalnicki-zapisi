import type { PoolItem } from '../../learn/types'
import { municipalityFor, optionsValid, pickItemSettlementDistractors } from '../distractors'
import { shuffled } from '../rng'
import { churchItems, type QuestionGenerator } from './generator'

/** crkva: which settlement is the church in? */
export const crkvaQuestions: QuestionGenerator<PoolItem> = {
  candidates: churchItems,
  question(item, { pool, difficulty, rng }) {
    const settlement = pool.settlements.find(s => s.id === item.settlementId)?.name ?? item.settlementId
    const unit = municipalityFor(pool, item.municipalityId)
    const names = pickItemSettlementDistractors(item, pool, difficulty, rng)
    if (names.length < 2) return null
    const options = shuffled([settlement, ...names], rng).map(name => ({ hr: name, en: name }))
    if (!optionsValid(options)) return null
    const correct = options.findIndex(o => o.hr === settlement)
    const unitLabel = unit?.label ?? ''
    return {
      prompt: {
        hr: `Gdje se nalazi ${item.name}?`,
        en: `Where is ${item.name}?`
      },
      options,
      correct,
      explanation: {
        hr: `${item.name} je u naselju ${settlement}${unitLabel ? ` (${unitLabel})` : ''}.`,
        en: `${item.name} is in ${settlement}${unitLabel ? ` (${unitLabel})` : ''}.`
      },
      archivePath: item.path
    }
  }
}
