import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  adminNavVisible,
  ADMIN_NAV_GROUPS
} from '../app/utils/adminNav'
import {
  editorialRouteKind,
  normalizeProtectedApiPath
} from '../server/utils/editorialCapabilities'
import type { ReviewerContext } from '../server/utils/reviewerContext'

beforeEach(() => {
  vi.stubGlobal('createError', (error: { statusCode?: number, statusMessage?: string }) => {
    const err = new Error(error.statusMessage ?? 'error')
    return Object.assign(err, error)
  })
})

describe('editorial route capabilities', () => {
  it('classifies session, editorial and user-management paths', () => {
    expect(editorialRouteKind('/api/admin/session')).toBe('session')
    expect(editorialRouteKind('/api/admin/social-session')).toBe('session')
    expect(editorialRouteKind('/api/admin/accounts')).toBe('user-management')
    expect(editorialRouteKind('/api/admin/accounts/pending')).toBe('user-management')
    expect(editorialRouteKind('/api/admin/accounts/u1/promote')).toBe('user-management')
    expect(editorialRouteKind('/api/admin/inbox')).toBe('editorial')
    expect(editorialRouteKind('/api/admin/content/word')).toBe('editorial')
    expect(editorialRouteKind('/api/review/submissions')).toBe('editorial')
    expect(editorialRouteKind('/api/submissions')).toBeNull()
    expect(normalizeProtectedApiPath('//API//Admin//Accounts//')).toBe('/api/admin/accounts')
  })

  it('allows only a Google admin for user management', async () => {
    const { assertUserManagementAccess } = await import('../server/utils/editorialCapabilities')
    const admin: ReviewerContext = { mode: 'social', role: 'admin', accountId: 'a1', email: 'a@e.com' }
    expect(() => assertUserManagementAccess(admin)).not.toThrow()
    for (const context of [
      { mode: 'social', role: 'maintainer', accountId: 'm1', email: 'm@e.com' },
      { mode: 'social', role: 'none', accountId: 'n1', email: 'n@e.com' },
      { mode: 'password', role: 'admin', accountId: null, email: null },
      { mode: 'automation', role: 'admin', accountId: null, email: null }
    ] as const satisfies ReviewerContext[]) {
      expect(() => assertUserManagementAccess(context)).toThrow(expect.objectContaining({ statusCode: 403 }))
    }
  })
})

describe('admin navigation visibility', () => {
  const korisnici = ADMIN_NAV_GROUPS[0]!.items.find(item => item.to === '/admin/korisnici')!
  const prijedlozi = ADMIN_NAV_GROUPS[0]!.items.find(item => item.to === '/admin/prijedlozi')!

  it('hides Korisnici without user management and keeps editorial entries', () => {
    expect(adminNavVisible(korisnici, false)).toBe(false)
    expect(adminNavVisible(korisnici, true)).toBe(true)
    expect(adminNavVisible(prijedlozi, false)).toBe(true)
    expect(adminNavVisible(prijedlozi, true)).toBe(true)
  })
})
