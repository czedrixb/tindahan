<script setup lang="ts">
import { PhChartBar, PhClockCounterClockwise, PhGearSix, PhHouse, PhPackage, PhShoppingCartSimple } from '@phosphor-icons/vue'
import type { Component } from 'vue'

// Desktop workspace navigation (docs/2026-09-13-pos-redesign.md: "slim sidebar
// for Overview, New sale, Sales history, Inventory, Reports, and Settings").
// Hidden below `lg` - BottomNav.vue is the mobile equivalent and carries the
// same aria-label so exactly one "Primary" nav is visible at any breakpoint.
interface NavItem {
  label: string
  to: string
  icon: Component
  match: (path: string) => boolean
}

const items: NavItem[] = [
  { label: 'Overview', to: '/', icon: PhHouse, match: (p) => p === '/' },
  { label: 'New sale', to: '/sales/new', icon: PhShoppingCartSimple, match: (p) => p.startsWith('/sales/new') },
  { label: 'Sales history', to: '/sales', icon: PhClockCounterClockwise, match: (p) => p === '/sales' },
  { label: 'Inventory', to: '/inventory', icon: PhPackage, match: (p) => p.startsWith('/inventory') || p.startsWith('/products') },
  { label: 'Reports', to: '/reports', icon: PhChartBar, match: (p) => p.startsWith('/reports') },
  { label: 'Settings', to: '/settings', icon: PhGearSix, match: (p) => p.startsWith('/settings') },
]

const route = useRoute()
const { session } = useSession()

const initials = computed(() => {
  const name = session.value?.user?.displayName?.trim() ?? ''
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return letters || '?'
})
</script>

<template>
  <aside class="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-surface">
    <div class="flex items-center gap-2 px-5 pt-6 pb-4">
      <BrandMark :size="28" />
      <span class="text-sm font-bold tracking-tight text-ink">Tindahan</span>
    </div>

    <nav class="flex-1 space-y-0.5 px-3" aria-label="Primary">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="focus-ring flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium"
        :class="item.match(route.path) ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:bg-neutral-50'"
      >
        <component :is="item.icon" class="h-5 w-5" :weight="item.match(route.path) ? 'fill' : 'regular'" aria-hidden="true" />
        {{ item.label }}
      </NuxtLink>
    </nav>

    <NuxtLink
      to="/settings"
      class="focus-ring flex items-center gap-3 border-t border-line px-5 py-4"
    >
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700"
        aria-hidden="true"
      >
        {{ initials }}
      </span>
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-ink">{{ session?.user?.displayName }}</p>
        <p class="truncate text-xs text-ink-subtle">@{{ session?.user?.username }}</p>
      </div>
    </NuxtLink>
  </aside>
</template>
