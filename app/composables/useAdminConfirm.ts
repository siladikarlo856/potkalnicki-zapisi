import AdminConfirmDialog from '~/components/admin/ConfirmDialog.vue'

export interface AdminConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  color?: 'primary' | 'error' | 'warning' | 'neutral'
  icon?: string
}

/**
 * `const confirm = useAdminConfirm()`, then `if (await confirm({ title: '…' }))`. Resolves to
 * false when cancelled or dismissed. Each confirmation is its own overlay, removed after closing.
 */
export function useAdminConfirm() {
  const overlay = useOverlay()
  return async (options: AdminConfirmOptions) => {
    const dialog = overlay.create(AdminConfirmDialog, { destroyOnClose: true })
    return (await dialog.open(options).result) === true
  }
}
