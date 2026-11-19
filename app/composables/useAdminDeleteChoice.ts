import AdminDeleteChoiceDialog from '~/components/admin/DeleteChoiceDialog.vue'

export interface AdminDeleteChoiceOptions {
  title: string
  description: string
  deleteLabel: string
  archiveLabel?: string
}

/** `await choose({ ... })` → 'cancel' (also when dismissed), 'archive' or 'delete'. */
export function useAdminDeleteChoice() {
  const overlay = useOverlay()
  return async (options: AdminDeleteChoiceOptions) => {
    const dialog = overlay.create(AdminDeleteChoiceDialog, { destroyOnClose: true })
    return ((await dialog.open(options).result) ?? 'cancel') as 'cancel' | 'archive' | 'delete'
  }
}
