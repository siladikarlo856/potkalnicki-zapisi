export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'slate'
    },
    badge: {
      compoundVariants: [{ color: 'primary', variant: 'subtle', class: 'text-(--ui-color-primary-800) dark:text-primary' }]
    }
  },
  site: {
    // Named in the privacy notice for questions, corrections and deletion requests.
    privacyEmail: 'siladikarlo856@gmail.com'
  }
})
