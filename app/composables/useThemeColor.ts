// Mobile browser bars match the page background: white, or slate-900 in dark mode.
const defaultLightBg = '#ffffff'
const defaultDarkBg = '#0f172b'

/** Sets the theme-color meta tag. app.vue and error.vue both call it, because error.vue replaces app.vue. */
export function useThemeColor(lightBg = defaultLightBg, darkBg = defaultDarkBg) {
  const colorMode = useColorMode()

  useSeoMeta({
    themeColor: () => colorMode.preference === 'system'
      ? [
          { content: lightBg, media: '(prefers-color-scheme: light)' },
          { content: darkBg, media: '(prefers-color-scheme: dark)' }
        ]
      : colorMode.value === 'dark' ? darkBg : lightBg
  })
}
