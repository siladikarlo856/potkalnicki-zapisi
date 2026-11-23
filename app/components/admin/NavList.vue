<script setup lang="ts">
import { ADMIN_INBOX_PATH, ADMIN_NAV_GROUPS, type AdminNavItem, adminNavActive, adminNavVisible } from '~/utils/adminNav'

// The four navigation groups as links, with the pending badge on the inbox. The sidebar (full or rail) and the phone's
// "Sadržaj" sheet render it. Inside the sidebar the `group/side` ancestor decides, by CSS alone, whether labels and group
// headings show (full) or hide (rail, from `md` to `lg` or collapsed); the phone sheet, below `md`, always shows them. Every
// item keeps its accessible name, and `rail` only adds the tooltip.
const props = withDefaults(defineProps<{
  rail?: boolean
  /** Limits what is shown, by group label. */
  groups?: string[]
}>(), { groups: undefined })

const route = useRoute()
const { pending } = useAdminPending()
const userManagement = useAdminUserManagement()
function visibleItems(items: AdminNavItem[]) {
  return items.filter(item => adminNavVisible(item, userManagement.data.value))
}
const shown = computed(() => (props.groups ? ADMIN_NAV_GROUPS.filter(group => props.groups!.includes(group.label)) : ADMIN_NAV_GROUPS)
  .map(group => ({ ...group, items: visibleItems(group.items) }))
  .filter(group => group.items.length > 0))
const headingId = (label: string) => `admin-nav-${label.toLowerCase().normalize('NFD').replace(/[^a-z]+/g, '-')}`
</script>

<template>
  <div class="flex flex-col gap-4">
    <section
      v-for="group in shown"
      :key="group.label"
      :aria-labelledby="headingId(group.label)"
    >
      <h2
        :id="headingId(group.label)"
        class="pz-overline px-2.5 pb-1 text-muted md:max-lg:sr-only group-data-[sidebar=collapsed]/side:sr-only"
      >
        {{ group.label }}
      </h2>
      <ul class="flex flex-col gap-0.5">
        <li
          v-for="item in group.items"
          :key="item.to"
        >
          <UTooltip
            :text="item.label"
            :disabled="!rail"
            :content="{ side: 'right' }"
          >
            <NuxtLink
              :to="item.to"
              :aria-current="adminNavActive(item, route.path) ? 'page' : undefined"
              class="relative flex min-h-9 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-default no-underline hover:bg-elevated aria-[current=page]:bg-primary aria-[current=page]:font-bold aria-[current=page]:text-inverted md:max-lg:justify-center group-data-[sidebar=collapsed]/side:justify-center forced-colors:aria-[current=page]:border"
              :data-testid="`admin-nav-${item.to.split('/').pop() || 'ploca'}`"
            >
              <UIcon
                :name="item.icon"
                class="size-5 shrink-0"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1 truncate md:max-lg:sr-only group-data-[sidebar=collapsed]/side:sr-only">{{ item.label }}</span>
              <PzBadge
                v-if="item.to === ADMIN_INBOX_PATH"
                :count="pending"
                :noun="PENDING_NOUN"
                variant="attn"
                class="md:max-lg:absolute md:max-lg:-top-1 md:max-lg:-right-1 md:max-lg:h-4.5 md:max-lg:min-w-4.5 md:max-lg:px-1 md:max-lg:text-[0.6875rem] group-data-[sidebar=collapsed]/side:absolute group-data-[sidebar=collapsed]/side:-top-1 group-data-[sidebar=collapsed]/side:-right-1 group-data-[sidebar=collapsed]/side:h-4.5 group-data-[sidebar=collapsed]/side:min-w-4.5 group-data-[sidebar=collapsed]/side:px-1"
                data-testid="admin-pending"
              />
            </NuxtLink>
          </UTooltip>
        </li>
      </ul>
    </section>
  </div>
</template>
