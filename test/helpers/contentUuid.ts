import { createHash } from 'node:crypto'

/** Node twin of public.content_uuid: MD5 of the name with the UUIDv8 version nibble and RFC 9562 variant bits. */
export function contentUuid(name: string) {
  const b = createHash('md5').update(name).digest()
  b[6] = (b[6]! & 0x0f) | 0x80
  b[8] = (b[8]! & 0x3f) | 0x80
  const hex = b.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
