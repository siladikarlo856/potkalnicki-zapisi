import type { AccountAuditAction, AccountPendingStatus, AccountRole } from '~~/shared/types/accounts'

export const ACCOUNT_ROLE_LABELS: Record<AccountRole, string> = {
  none: 'Bez uloge',
  maintainer: 'Održavatelj',
  admin: 'Administrator'
}

export const ACCOUNT_PENDING_STATUS_LABELS: Record<AccountPendingStatus, string> = {
  pending: 'Na čekanju',
  consumed: 'Iskorišteno',
  cancelled: 'Otkazano'
}

export const ACCOUNT_AUDIT_ACTION_LABELS: Record<AccountAuditAction, string> = {
  bootstrap_admin: 'Bootstrap administratora',
  grant_maintainer: 'Dodjela održavatelja',
  cancel_pending: 'Otkaz prethodne autorizacije',
  revoke_role: 'Opoziv uloge'
}
