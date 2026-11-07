import { pluralFormHr } from '~/utils/plural'

// "3 oblika", "21 selu": a counted noun from i18n, with one key per plural category
// (`<key>.one`, `<key>.few`, `<key>.other`). English only has one and other.
export function usePzCount() {
  const { t, locale } = useI18n()
  return (key: string, n: number) => {
    const form = locale.value === 'hr' ? pluralFormHr(n) : n === 1 ? 'one' : 'other'
    return t(`${key}.${form}`, { n })
  }
}
