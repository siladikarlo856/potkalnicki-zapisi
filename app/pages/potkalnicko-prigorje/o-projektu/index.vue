<script setup lang="ts">
definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t, tm } = useI18n()
const localePath = useLocalePath()
const { site } = useAppConfig()

useSeoMeta({
  title: () => t('pz.about.title'),
  ogTitle: () => `${t('pz.about.title')} · Potkalnički zapisi`,
  ogDescription: () => t('pz.about.intro'),
  description: () => t('pz.about.intro')
})

const sections = ['author', 'controller', 'method', 'sources'] as const

function count(key: string) {
  const messages = tm(key)
  return Array.isArray(messages) ? messages.length : 0
}
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <article class="mx-auto flex max-w-2xl flex-col gap-8">
      <header>
        <h1 class="text-3xl font-bold tracking-tight text-highlighted sm:text-4xl">
          {{ t('pz.about.title') }}
        </h1>
        <p class="mt-4 text-muted">
          {{ t('pz.about.intro') }}
        </p>
      </header>

      <section
        v-for="section in sections"
        :id="section === 'sources' ? 'izvori' : undefined"
        :key="section"
        class="flex flex-col gap-3"
      >
        <h2 class="text-xl font-semibold text-highlighted">
          {{ t(`pz.about.sections.${section}.title`) }}
        </h2>
        <p
          v-for="i in count(`pz.about.sections.${section}.text`)"
          :key="`${section}-${i}`"
          class="text-default"
        >
          {{ t(`pz.about.sections.${section}.text.${i - 1}`) }}
        </p>
        <ul
          v-if="count(`pz.about.sections.${section}.items`)"
          class="flex list-disc flex-col gap-1.5 pl-5 text-default"
        >
          <li
            v-for="i in count(`pz.about.sections.${section}.items`)"
            :key="`${section}-item-${i}`"
          >
            {{ t(`pz.about.sections.${section}.items.${i - 1}`) }}
          </li>
        </ul>
        <p
          v-if="section === 'controller'"
          class="text-default"
        >
          <ULink
            :to="localePath('/potkalnicko-prigorje/privatnost')"
            class="text-primary underline underline-offset-2"
          >
            {{ t('pz.about.privacyLink') }}
          </ULink>
        </p>
        <p
          v-if="section === 'controller'"
          class="text-default"
        >
          <ULink
            :to="`mailto:${site.privacyEmail}`"
            class="text-primary underline underline-offset-2"
          >
            {{ site.privacyEmail }}
          </ULink>
        </p>
        <p
          v-if="section === 'sources'"
          class="text-default"
        >
          <ULink
            :to="localePath('/potkalnicko-prigorje/o-projektu/fotografije')"
            class="text-primary underline underline-offset-2"
          >
            {{ t('pz.photos.creditsLink') }}
          </ULink>
        </p>
      </section>

      <p class="text-sm text-dimmed">
        {{ t('pz.about.footerNote') }}
      </p>
    </article>
  </UContainer>
</template>
