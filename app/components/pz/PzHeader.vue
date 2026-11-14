<script setup lang="ts">
import { pzHeaderNavItems, pzSectionForPath } from '~~/shared/utils/pzNav'
import { pzRoutes } from '~~/shared/utils/appRoutes'

// Mobile (below 1024px): the logo, the theme toggle and a menu with all seven sections and
// Privatnost. The tab bar marks the current section there, so the header does not.
// Desktop: the seven sections inline, then the theme toggle.
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()

const items = computed(() => pzHeaderNavItems().map(item => ({ ...item, href: localePath(item.to) })))
const currentSection = computed(() => pzSectionForPath(route.path))
const menuOpen = ref(false)
const privacyHref = computed(() => localePath(pzRoutes.privacy))

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
