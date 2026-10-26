export interface LetterDiffPart {
  kind: 'same' | 'added' | 'removed'
  text: string
}

/**
 * Aligns a regional spelling against its headword letter by letter (longest
 * common subsequence), so the letters that differ can be highlighted.
 */
export function letterDiff(base: string, form: string): LetterDiffPart[] {
  const a = [...base]
  const b = [...form]
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }

  const parts: LetterDiffPart[] = []
  const push = (kind: LetterDiffPart['kind'], char: string) => {
    const last = parts.at(-1)
    if (last?.kind === kind) last.text += char
    else parts.push({ kind, text: char })
  }

  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('same', b[j]!)
      i++
      j++
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      push('removed', a[i]!)
      i++
    } else {
      push('added', b[j]!)
      j++
    }
  }
  while (i < a.length) push('removed', a[i++]!)
  while (j < b.length) push('added', b[j++]!)
  return parts
}
