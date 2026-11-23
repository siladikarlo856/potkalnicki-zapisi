import { databaseError, useDatabaseClient } from './db'
import { normalizeAccountEmail, verifiedProviderEmail } from './accountSync'
import type {
  AccountAdminList,
  AccountAuditRow,
  AccountPendingRow,
  AccountRow
} from '~~/shared/types/accounts'

const ACCOUNT_PAGE_SIZE = 25
const AUDIT_LIMIT = 50

function mapProfile(row: {
  id: string
  email: string | null
  role: string
  created_at: string
}): AccountRow {
  return { id: row.id, email: row.email, role: row.role as AccountRow['role'], createdAt: row.created_at }
}

function mapPending(row: {
  id: string
  email: string
  status: string
  granted_role: string
  created_at: string
  created_by: string | null
  matched_account_id: string | null
  matched_at: string | null
}): AccountPendingRow {
  return {
    id: row.id,
    email: row.email,
    status: row.status as AccountPendingRow['status'],
    grantedRole: row.granted_role as AccountPendingRow['grantedRole'],
    createdAt: row.created_at,
    createdBy: row.created_by,
    matchedAccountId: row.matched_account_id,
    matchedAt: row.matched_at
  }
}

function mapAudit(row: {
  id: number
  action: string
  actor_id: string | null
  target_account_id: string | null
  target_email: string | null
  pending_email_id: string | null
  role_before: string | null
  role_after: string | null
  created_at: string
}): AccountAuditRow {
  return {
    id: row.id,
    action: row.action as AccountAuditRow['action'],
    actorId: row.actor_id,
    targetAccountId: row.target_account_id,
    targetEmail: row.target_email,
    pendingEmailId: row.pending_email_id,
    roleBefore: row.role_before as AccountAuditRow['roleBefore'],
    roleAfter: row.role_after as AccountAuditRow['roleAfter'],
    createdAt: row.created_at
  }
}

export async function listAccountsAdmin(query: string, page: number, pendingPage = 1, size = ACCOUNT_PAGE_SIZE): Promise<AccountAdminList> {
  const db = useDatabaseClient()
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
  const safePendingPage = Number.isFinite(pendingPage) && pendingPage >= 1 ? Math.floor(pendingPage) : 1
  const safeSize = Math.min(Math.max(size, 1), ACCOUNT_PAGE_SIZE)
  const from = (safePage - 1) * safeSize
  const to = from + safeSize - 1
  const term = normalizeAccountEmail(query).slice(0, 100)
  let accountRequest = db.from('account_profiles').select('id, email, role, created_at', { count: 'exact' })
  const pattern = `%${term.replace(/[%_\\]/g, '\\$&')}%`
  if (term) accountRequest = accountRequest.ilike('email_normalized', pattern)
  accountRequest = accountRequest.order('created_at', { ascending: false }).order('id').range(from, to)
  const pendingFrom = (safePendingPage - 1) * safeSize
  let pendingRequest = db.from('account_pending_emails')
    .select('id, email, status, granted_role, created_at, created_by, matched_account_id, matched_at', { count: 'exact' })
    .eq('status', 'pending')
  if (term) pendingRequest = pendingRequest.ilike('email_normalized', pattern)
  pendingRequest = pendingRequest
    .order('created_at', { ascending: false })
    .order('id')
    .range(pendingFrom, pendingFrom + safeSize - 1)
  const [accounts, pending] = await Promise.all([accountRequest, pendingRequest])
  if (accounts.error) databaseError(accounts.error)
  if (pending.error) databaseError(pending.error)
  return {
    accounts: (accounts.data ?? []).map(mapProfile),
    pending: (pending.data ?? []).map(mapPending),
    accountsTotal: accounts.count ?? 0,
    pendingTotal: pending.count ?? 0,
    page: safePage,
    pendingPage: safePendingPage,
    size: safeSize
  }
}

export async function listAccountAudit(): Promise<AccountAuditRow[]> {
  const { data, error } = await useDatabaseClient()
    .from('account_role_audit')
    .select('id, action, actor_id, target_account_id, target_email, pending_email_id, role_before, role_after, created_at')
    .order('created_at', { ascending: false })
    .limit(AUDIT_LIMIT)
  if (error) databaseError(error)
  return (data ?? []).map(mapAudit)
}

export async function preauthorizeMaintainer(actorId: string, email: string) {
  const normalized = normalizeAccountEmail(email)
  if (!normalized) throw createError({ statusCode: 400, statusMessage: 'E-pošta je obavezna' })
  const { data, error } = await useDatabaseClient().rpc('account_admin_preauthorize_maintainer', {
    p_actor_id: actorId,
    p_email: normalized
  })
  if (error) {
    if (error.code === '23505') throw createError({ statusCode: 409, statusMessage: 'Ta e-pošta je već na listi čekanja' })
    databaseError(error)
  }
  return data as string
}

export async function cancelPendingEmail(actorId: string, pendingId: string) {
  const { error } = await useDatabaseClient().rpc('account_admin_cancel_pending', {
    p_actor_id: actorId,
    p_pending_id: pendingId
  })
  if (error) {
    if (error.message.includes('not open')) throw createError({ statusCode: 409, statusMessage: 'Zapis više nije otvoren' })
    if (error.message.includes('not found')) throw createError({ statusCode: 404, statusMessage: 'Zapis nije pronađen' })
    databaseError(error)
  }
}

async function verifiedTargetEmail(targetId: string) {
  const { data, error } = await useDatabaseClient().auth.admin.getUserById(targetId)
  if (error) {
    if (error.status === 404) throw createError({ statusCode: 404, statusMessage: 'Račun nije pronađen' })
    databaseError(error)
  }
  const email = data.user ? verifiedProviderEmail(data.user) : null
  if (!email) throw createError({ statusCode: 409, statusMessage: 'Račun mora imati potvrđenu Google e-poštu' })
  return email
}

export async function promoteMaintainer(actorId: string, targetId: string) {
  const email = await verifiedTargetEmail(targetId)
  const { error } = await useDatabaseClient().rpc('account_admin_promote_maintainer', {
    p_actor_id: actorId,
    p_target_id: targetId,
    p_email: email
  })
  if (error) {
    if (error.message.includes('only role-less')) throw createError({ statusCode: 409, statusMessage: 'Račun već ima uredničku ulogu' })
    if (error.message.includes('not found')) throw createError({ statusCode: 404, statusMessage: 'Račun nije pronađen' })
    databaseError(error)
  }
}

export async function revokeMaintainer(actorId: string, targetId: string) {
  const email = await verifiedTargetEmail(targetId)
  const { error } = await useDatabaseClient().rpc('account_admin_revoke_maintainer', {
    p_actor_id: actorId,
    p_target_id: targetId,
    p_email: email
  })
  if (error) {
    if (error.message.includes('revoke themself')) throw createError({ statusCode: 409, statusMessage: 'Ne možete opozvati vlastitu ulogu' })
    if (error.message.includes('only maintainers')) throw createError({ statusCode: 409, statusMessage: 'Samo su održavatelji podložni opozivu' })
    if (error.message.includes('not found')) throw createError({ statusCode: 404, statusMessage: 'Račun nije pronađen' })
    databaseError(error)
  }
}
