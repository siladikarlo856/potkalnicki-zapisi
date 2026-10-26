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
    siladiDizajnUrl: '',
    social: [] as { label: string, icon: string, to: string }[]
  }
})
