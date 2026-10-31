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
    // Still open in the project hub. Empty values are hidden on the site.
    email: '',
    siladiDizajnUrl: 'https://siladi-dizajn.hr/',
    social: [
      { label: 'GitHub', icon: 'i-simple-icons-github', to: 'https://github.com/siladikarlo856' },
      { label: 'LinkedIn', icon: 'i-simple-icons-linkedin', to: 'https://www.linkedin.com/in/karlosiladi/' }
    ],
    // Named in the privacy notice for questions, corrections and deletion requests.
    privacyEmail: 'siladikarlo856@gmail.com'
  }
})
