import type { H3Event } from 'h3'

// In-memory fixed-window counters. They reset when the server restarts, which is fine for
// keeping casual spam and password guessing in check on a single Node process.
const buckets = new Map<string, Map<string, { count: number, resetAt: number }>>()

function entry(bucket: string, key: string, windowSeconds: number) {
  let counters = buckets.get(bucket)
  if (!counters) buckets.set(bucket, counters = new Map())

  const time = Date.now()
  if (counters.size > 1000) {
    for (const [k, value] of counters) {
      if (value.resetAt <= time) counters.delete(k)
    }
  }

  let current = counters.get(key)
  if (!current || current.resetAt <= time) {
    current = { count: 0, resetAt: time + windowSeconds * 1000 }
    counters.set(key, current)
  }
  return current
}

export function isRateLimited(bucket: string, key: string, max: number, windowSeconds: number) {
  return entry(bucket, key, windowSeconds).count >= max
}

export function countRateLimit(bucket: string, key: string, windowSeconds: number) {
  entry(bucket, key, windowSeconds).count++
}

// Behind Hostinger's proxy the socket address is the proxy, so the forwarded client address is
// used when present. Only the rightmost X-Forwarded-For entry is trusted: it is the one added by
// the nearest proxy, while entries to its left come from the client. This assumes one proxy.
export function clientKey(event: H3Event) {
  const forwarded = getRequestHeader(event, 'x-forwarded-for')?.split(',').at(-1)?.trim()
  return forwarded || getRequestIP(event) || 'unknown'
}
