import { describe, expect, it } from 'vitest'
import { integrationDb } from './support/integrationDb'

const SECRET = 'test-review-secret-0123456789'
const db = await integrationDb({ server: { NUXT_REVIEW_SECRET: SECRET } })

const USER_MANAGEMENT_ROUTES = [
  ['GET', '/api/admin/accounts'],
  ['GET', '/api/admin/accounts/audit'],
  ['POST', '/api/admin/accounts/pending', { email: 'pending@example.com' }],
  ['POST', '/api/admin/accounts/00000000-0000-4000-8000-000000000099/promote'],
  ['POST', '/api/admin/accounts/00000000-0000-4000-8000-000000000099/revoke']
] as const

describe.skipIf(!db.enabled)('Korisnici API authorization', () => {
  it('returns 403 for automation Bearer and unauthenticated requests', async () => {
    const automation = await db.fetch('/api/admin/accounts', {
      headers: { authorization: `Bearer ${SECRET}` }
    })
    expect(automation.status).toBe(403)
    const missing = await db.fetch('/api/admin/accounts')
    expect(missing.status).toBe(401)
  })

  it.each(USER_MANAGEMENT_ROUTES)('returns 403 for automation on %s %s', async (method, path, body) => {
    const headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }
    if (body !== undefined) headers['content-type'] = 'application/json'
    const response = await db.fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    expect(response.status).toBe(403)
  })
})
