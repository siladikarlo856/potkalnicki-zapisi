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

/** A counted noun: singular, the form after 2–4, and the form after 5 or more when it differs (filtar, filtra, filtara). */
export type PzNoun = [one: string, few: string, other?: string]

/** The noun form that agrees with `n`: "filtar" for 1, "filtra" for 2–4, "filtara" for 5 (singular for 21, not 11). */
export function nounFor(n: number, [one, few, other = few]: PzNoun): string {
  const form = pluralFormHr(n)
  return form === 'one' ? one : form === 'few' ? few : other
}

/** "1 zapis", "2 zapisa", "5 zapisa": Croatian count with its noun. */
export function countNoun(n: number, one: string, other: string): string {
  return `${n} ${nounFor(n, [one, other])}`
}
