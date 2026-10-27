export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'slate'
    }
  },
  site: {
    // Still open in the project hub. Empty values are hidden on the site.
    email: '',
    siladiDizajnUrl: 'https://siladi-dizajn.hr/',
    social: [] as { label: string, icon: string, to: string }[],
    // Named in the privacy notice for questions, corrections and deletion requests.
    privacyEmail: 'siladikarlo856@gmail.com'
  }
})
