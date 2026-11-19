<script setup lang="ts">
definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t, tm, locale } = useI18n()
const localePath = useLocalePath()
const { site } = useAppConfig()

useSeoMeta({
  title: () => t('privacy.title'),
  ogTitle: () => `${t('privacy.title')} · Potkalnički zapisi`,
  ogDescription: () => t('privacy.description'),
  description: () => t('privacy.description')
})

const updated = computed(() => new Date(`${PRIVACY_NOTICE_VERSION}T00:00:00Z`).toLocaleDateString(
  locale.value === 'hr' ? 'hr-HR' : 'en-GB',
  { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
))

const sections = ['controller', 'collected', 'device', 'analytics', 'purpose', 'optional', 'review', 'retention', 'access', 'rights', 'changes'] as const

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
          {{ t('privacy.title') }}
        </h1>
        <p class="mt-2 text-sm text-dimmed">
          {{ t('privacy.updated', { date: updated }) }}
        </p>
        <p class="mt-4 text-muted">
          {{ t('privacy.intro') }}
        </p>
      </header>

      <section
        v-for="section in sections"
        :key="section"
        class="flex flex-col gap-3"
      >
        <h2 class="text-xl font-semibold text-highlighted">
          {{ t(`privacy.sections.${section}.title`) }}
        </h2>
        <i18n-t
          v-for="i in count(`privacy.sections.${section}.text`)"
          :key="`text-${i}`"
          :keypath="`privacy.sections.${section}.text.${i - 1}`"
          tag="p"
          class="text-default"
          scope="global"
        >
          <template #email>
            <ULink
              :to="`mailto:${site.privacyEmail}`"
              class="text-primary underline underline-offset-2"
            >
              {{ site.privacyEmail }}
            </ULink>
          </template>
        </i18n-t>
        <ul
          v-if="count(`privacy.sections.${section}.items`)"
          class="flex list-disc flex-col gap-1.5 pl-5 text-default"
        >
          <li
            v-for="i in count(`privacy.sections.${section}.items`)"
            :key="`item-${i}`"
          >
            {{ t(`privacy.sections.${section}.items.${i - 1}`) }}
          </li>
        </ul>
        <p
          v-for="i in count(`privacy.sections.${section}.after`)"
          :key="`after-${i}`"
          class="text-default"
        >
          {{ t(`privacy.sections.${section}.after.${i - 1}`) }}
        </p>
      </section>

      <div>
        <UButton
          :to="localePath(pzRoutes.contribute)"
          :label="t('privacy.back')"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="subtle"
        />
      </div>
    </article>
  </UContainer>
</template>
