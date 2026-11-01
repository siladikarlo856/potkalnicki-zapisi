<script setup lang="ts">
const baseUrl = useRuntimeConfig().public.i18n.baseUrl

useThemeColor('#FDF9F0', '#14140F')
useHead({
  htmlAttrs: { 'data-site': 'pz' },
  titleTemplate: title => !title || title === 'Potkalnički zapisi' ? 'Potkalnički zapisi' : `${title} · Potkalnički zapisi`,
  link: [
    { key: 'site-icon', rel: 'icon', type: 'image/svg+xml', href: '/potkalnicko-prigorje/favicon.svg' },
    { key: 'site-apple-icon', rel: 'apple-touch-icon', href: '/potkalnicko-prigorje/apple-touch-icon.svg' }
  ]
})
useSeoMeta({
  description: 'Priče, ljudi i baština našega kraja.',
  ogTitle: 'Potkalnički zapisi',
  ogDescription: 'Priče, ljudi i baština našega kraja.',
  ogSiteName: 'Potkalnički zapisi',
  ogType: 'website',
  ogImage: `${baseUrl}/potkalnicko-prigorje/og.svg`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'Potkalnički zapisi - Priče, ljudi i baština našega kraja.',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <div>
    <PzHeader />
    <UMain
      id="main-content"
      tabindex="-1"
      class="focus:outline-none"
    >
      <slot />
    </UMain>
    <PzFooter />
  </div>
</template>
