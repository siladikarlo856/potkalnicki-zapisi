<script setup lang="ts">
import { pzFooterNavItems } from '~~/shared/utils/pzNav'

const { site } = useAppConfig()
const localePath = useLocalePath()
const footerLinks = computed(() => pzFooterNavItems(site.privacyEmail))
</script>

<template>
  <UFooter>
    <template #left>
      <div class="flex flex-col gap-3">
        <p class="text-sm text-muted">
          Potkalnički zapisi · Priče, ljudi i baština našega kraja.
        </p>
        <nav
          class="flex flex-wrap gap-x-4 text-sm"
          aria-label="Potkalnički zapisi"
        >
          <ULink
            v-for="link in footerLinks"
            :key="link.label"
            :to="link.to.startsWith('mailto:') ? link.to : localePath(link.to)"
            class="inline-flex min-h-(--pz-tap-min) items-center text-muted hover:text-default"
          >
            {{ link.label }}
          </ULink>
        </nav>
        <p class="text-xs text-dimmed">
          {{ $t('pz.footer.note') }}
        </p>
      </div>
    </template>
  </UFooter>
</template>
