// Dates and counts as the admin writes them (21-admin-screens.md "Density and input"): short in tables, long elsewhere.

const parse = (value: string | Date) => value instanceof Date ? value : new Date(value)

/** `3. 10. 2026.` for tables. */
export function shortDate(value: string | Date) {
  const date = parse(value)
  return `${date.getDate()}. ${date.getMonth() + 1}. ${date.getFullYear()}.`
}

/** `3. listopada 2026.` */
export function longDate(value: string | Date) {
  return parse(value).toLocaleDateString('hr-HR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** `14:05` */
export function clockTime(value: string | Date) {
  return parse(value).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })
}

/** `prije 2 minute`: how long ago, for conflict and restore messages. Coarse on purpose. */
export function agoPhrase(value: string | Date, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - parse(value).getTime()) / 60_000))
  if (minutes < 1) return 'maloprije'
  if (minutes < 60) return `prije ${minutes} ${nounFor(minutes, ['minutu', 'minute', 'minuta'])}`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `prije ${hours} ${nounFor(hours, ['sat', 'sata', 'sati'])}`
  const days = Math.round(hours / 24)
  return `prije ${days} ${nounFor(days, ['dan', 'dana', 'dana'])}`
}

/** `3 zapisa`: the number with its noun in the right case. */
export function recordsPhrase(count: number) {
  return `${count} ${nounFor(count, ['zapis', 'zapisa', 'zapisa'])}`
}
