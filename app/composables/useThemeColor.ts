// Mobile browser bars match the page background (--pz-bg), in light and dark mode.
const defaultLightBg = '#F3F4EE'
const defaultDarkBg = '#0F1512'

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
