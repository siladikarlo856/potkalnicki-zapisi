/** Croatian sort and search helpers for the content components. */
import { pluralFormHr } from './plural'

/** Lower-case and strip diacritics so `skrlak` finds `škrlak` (đ folds to d, as in the catalog slugs). */
export function foldHr(value: string): string {
  return value
    .toLocaleLowerCase('hr')
    .replaceAll('đ', 'd')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** The thirty letters of the Croatian alphabet, digraphs included, in dictionary order. */
export const HR_ALPHABET = [
  'A', 'B', 'C', 'Č', 'Ć', 'D', 'DŽ', 'Đ', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'LJ', 'M', 'N', 'NJ',
  'O', 'P', 'R', 'S', 'Š', 'T', 'U', 'V', 'Z', 'Ž'
] as const

/** Dictionary order for Croatian words. */
export const compareHr = new Intl.Collator('hr').compare

/** The alphabet letter a word is filed under: a digraph (DŽ, LJ, NJ) wins over its first character. */
export function alphabetLetter(word: string): string | undefined {
  const upper = word.toLocaleUpperCase('hr')
  return [...HR_ALPHABET].sort((a, b) => b.length - a.length).find(letter => upper.startsWith(letter))
}

/** "1 zapis", "2 zapisa", "5 zapisa": Croatian count with its noun (singular only for 1, 21, 31 …, not 11). */
export function countNoun(n: number, one: string, other: string): string {
  return `${n} ${pluralFormHr(n) === 'one' ? one : other}`
}
