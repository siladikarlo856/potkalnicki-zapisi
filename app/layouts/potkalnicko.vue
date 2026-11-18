<script setup lang="ts">
// Below 1024px the fixed tab bar sits over the bottom, so the page reserves its height plus the
// safe-area inset. A hidden bar frees the space for the sticky action bar.
const { hidden: tabBarHidden } = usePzTabBar()
const roundActive = useState('pz-round-shell-active', () => false)
const baseUrl = useRuntimeConfig().public.i18n.baseUrl
const cloudflareAnalyticsToken = useRuntimeConfig().public.cloudflareAnalyticsToken

useThemeColor('#FDF9F0', '#14140F')
useHead({
  htmlAttrs: { 'data-site': 'pz' },
  titleTemplate: title => !title || title === 'Potkalnički zapisi' ? 'Potkalnički zapisi' : `${title} · Potkalnički zapisi`,
  link: [
    { key: 'site-icon', rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { key: 'site-apple-icon', rel: 'apple-touch-icon', href: '/apple-touch-icon.svg' }
  ],
  script: [{ 'type': 'module', 'src': 'https://static.cloudflareinsights.com/beacon.min.js', 'data-cf-beacon': JSON.stringify({ token: cloudflareAnalyticsToken }) }]
})
useSeoMeta({
  description: 'Priče, ljudi i baština našega kraja.',
  ogTitle: 'Potkalnički zapisi',
  ogDescription: 'Priče, ljudi i baština našega kraja.',
  ogSiteName: 'Potkalnički zapisi',
  ogType: 'website',
  ogImage: `${baseUrl}/og.svg`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'Potkalnički zapisi - Priče, ljudi i baština našega kraja.',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <div
    :class="tabBarHidden ? undefined : 'pb-[calc(var(--pz-tabbar-h)+env(safe-area-inset-bottom))] lg:pb-0 print:pb-0'"
  >
    <template v-if="!roundActive">
      <AppHeader />
      <SectionStrip />
    </template>
    <UMain
      id="main-content"
      tabindex="-1"
      class="focus:outline-none"
    >
      <slot />
    </UMain>
    <PzFooter v-if="!roundActive" />
    <BottomNav />
  </div>
</template>
