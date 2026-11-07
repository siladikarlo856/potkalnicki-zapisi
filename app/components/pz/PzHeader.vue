<script setup lang="ts">
import { pzHeaderNavItems, pzSectionForPath } from '~~/shared/utils/pzNav'
import { pzRoutes } from '~~/shared/utils/appRoutes'

// Mobile (below 1024px): the logo, the theme toggle and a menu with all six sections, HR/EN and
// Privatnost. The tab bar marks the current section there, so the header does not.
// Desktop: the six sections inline, then HR/EN, then the theme toggle.
const { t, locale } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()

const items = computed(() => pzHeaderNavItems().map(item => ({ ...item, href: localePath(item.to) })))
const currentSection = computed(() => pzSectionForPath(route.path))
const menuOpen = ref(false)
const privacyHref = computed(() => localePath(pzRoutes.privacy))

// The Potkalnički zapisi pages exist in Croatian only, so EN has no page to go to and shows as unavailable.
const languages = computed(() => (['hr', 'en'] as const).map(code => ({
  code,
  label: code.toUpperCase(),
  href: code === locale.value ? undefined : switchLocalePath(code) || undefined,
  current: code === locale.value
})))

watch(() => route.fullPath, () => {
  menuOpen.value = false
})

const iconButton = 'size-(--pz-tap-min) justify-center rounded-md text-default'
</script>

<template>
  <header class="z-50 border-b border-default bg-default lg:sticky lg:top-0 print:static">
    <UContainer class="flex h-(--pz-header-h) items-center gap-3 pr-2 lg:h-16 lg:gap-6 lg:pr-6">
      <NuxtLink
        :to="localePath(pzRoutes.home)"
        class="inline-flex min-h-(--pz-tap-min) items-center rounded-md"
        data-testid="pz-logo-link"
      >
        <PzLogo />
      </NuxtLink>

      <nav
        :aria-label="t('pz.nav.sections')"
        class="ms-6 hidden lg:block"
        data-testid="pz-header-nav"
      >
        <ul class="flex gap-0.5">
          <li
            v-for="item in items"
            :key="item.to"
          >
            <NuxtLink
              :to="item.href"
              :aria-current="currentSection === item.to ? 'page' : undefined"
              class="pz-body inline-flex min-h-(--pz-tap-min) items-center rounded-md px-3 font-medium text-muted hover:bg-muted hover:text-default aria-[current=page]:bg-accented aria-[current=page]:font-semibold aria-[current=page]:text-default"
            >
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <div class="ms-auto flex items-center gap-0.5">
        <span
          role="group"
          :aria-label="t('language.label')"
          class="pz-caption me-2 hidden rounded-full border border-accented p-0.5 lg:inline-flex"
          data-testid="pz-lang-desktop"
        >
          <template
            v-for="language in languages"
            :key="language.code"
          >
            <NuxtLink
              v-if="language.href"
              :to="language.href"
              :lang="language.code"
              :hreflang="language.code"
              class="rounded-full px-2.5 py-1.5 font-semibold text-muted hover:text-default"
            >
              {{ language.label }}
            </NuxtLink>
            <span
              v-else
              :lang="language.code"
              :aria-current="language.current ? 'true' : undefined"
              :aria-disabled="language.current ? undefined : 'true'"
              class="rounded-full px-2.5 py-1.5 font-semibold"
              :class="language.current ? 'bg-accented text-default' : 'text-dimmed'"
            >
              {{ language.label }}
            </span>
          </template>
        </span>

        <UColorModeButton
          color="neutral"
          variant="ghost"
          :class="iconButton"
        />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-menu"
          :aria-label="t('pz.nav.menu')"
          :class="`${iconButton} lg:hidden`"
          data-testid="pz-menu-button"
          @click="menuOpen = true"
        />
      </div>
    </UContainer>

    <UDrawer
      v-model:open="menuOpen"
      direction="right"
      :handle="false"
      :title="t('pz.nav.menu')"
      :description="t('pz.nav.menuDescription')"
      close
      :ui="{ content: 'w-80 max-w-[85vw]', description: 'sr-only' }"
    >
      <template #body>
        <nav
          :aria-label="t('pz.nav.sections')"
          data-testid="pz-menu-sections"
        >
          <ul class="flex flex-col">
            <li
              v-for="item in items"
              :key="item.to"
            >
              <NuxtLink
                :to="item.href"
                class="pz-label flex min-h-(--pz-tap-min) items-center rounded-md px-3 text-default hover:bg-muted"
              >
                {{ item.label }}
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <div class="mt-4 flex flex-col gap-3 border-t border-default pt-4">
          <span
            role="group"
            :aria-label="t('language.label')"
            class="pz-caption inline-flex self-start rounded-full border border-accented p-0.5"
            data-testid="pz-lang-menu"
          >
            <template
              v-for="language in languages"
              :key="language.code"
            >
              <NuxtLink
                v-if="language.href"
                :to="language.href"
                :lang="language.code"
                :hreflang="language.code"
                class="rounded-full px-3 py-2 font-semibold text-muted"
              >
                {{ language.label }}
              </NuxtLink>
              <span
                v-else
                :lang="language.code"
                :aria-current="language.current ? 'true' : undefined"
                :aria-disabled="language.current ? undefined : 'true'"
                class="rounded-full px-3 py-2 font-semibold"
                :class="language.current ? 'bg-accented text-default' : 'text-dimmed'"
              >
                {{ language.label }}
              </span>
            </template>
          </span>
          <NuxtLink
            :to="privacyHref"
            class="pz-body-sm inline-flex min-h-(--pz-tap-min) items-center px-3 text-muted underline"
          >
            {{ t('pz.nav.privacy') }}
          </NuxtLink>
        </div>
      </template>
    </UDrawer>
  </header>
</template>
