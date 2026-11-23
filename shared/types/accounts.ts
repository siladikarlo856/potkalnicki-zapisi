export type AccountRole = 'none' | 'maintainer' | 'admin'

export type AccountPendingStatus = 'pending' | 'consumed' | 'cancelled'

export interface AccountRow {
  id: string
  email: string | null
  role: AccountRole
  createdAt: string
}

export interface AccountPendingRow {
  id: string
  email: string
  status: AccountPendingStatus
  grantedRole: AccountRole
  createdAt: string
  createdBy: string | null
  matchedAccountId: string | null
  matchedAt: string | null
}

export type AccountAuditAction = 'bootstrap_admin' | 'grant_maintainer' | 'cancel_pending' | 'revoke_role'

export interface AccountAuditRow {
  id: number
  action: AccountAuditAction
  actorId: string | null
  targetAccountId: string | null
  targetEmail: string | null
  pendingEmailId: string | null
  roleBefore: AccountRole | null
  roleAfter: AccountRole | null
  createdAt: string
}

export interface AccountAdminList {
  accounts: AccountRow[]
  pending: AccountPendingRow[]
  accountsTotal: number
  pendingTotal: number
  page: number
  pendingPage: number
  size: number
}
