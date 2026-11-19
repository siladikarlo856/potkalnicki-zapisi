import AdminUnsavedDialog from '~/components/admin/UnsavedDialog.vue'

/** `const choose = useAdminUnsavedChoice()`, then `await choose({ fields: 2, canSaveDraft: true })` → 'discard', 'stay' or 'save'. */
export function useAdminUnsavedChoice() {
  const overlay = useOverlay()
  return async (props: { fields: number, canSaveDraft: boolean }) => {
    const dialog = overlay.create(AdminUnsavedDialog, { destroyOnClose: true })
    return ((await dialog.open(props).result) ?? 'stay') as 'discard' | 'stay' | 'save'
  }
}
