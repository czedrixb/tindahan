<script setup lang="ts">
// Home-only hero header (mark, profile chip, and headline). Deliberately not
// a PageHeader variant - PageHeader's rendered height is load-bearing for
// .sticky-search on /sales/new and /inventory (see --header-h in main.css),
// and this header isn't sticky, so keeping it a separate component avoids
// coupling that offset to a second set of markup. The mark/chip row hides at
// `lg`, where AppSidebar already carries the brand mark and signed-in user.
const props = defineProps<{
  title: string
  subtitle?: string
}>()

useHead({ title: () => props.title })

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
  <header class="safe-top page-shell pb-2 [--safe-pt:1.75rem] lg:pb-4">
    <div class="flex items-center justify-between gap-3 lg:hidden">
      <div class="flex items-center gap-2">
        <BrandMark :size="28" />
        <span class="text-sm font-bold tracking-tight text-ink">Tindahan</span>
      </div>

      <div class="flex min-w-0 items-center gap-3">
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700"
          aria-hidden="true"
        >
          {{ initials }}
        </span>
      </div>
    </div>

    <h1 class="mt-5 text-2xl font-bold leading-tight text-ink lg:mt-0">{{ title }}</h1>
    <p v-if="subtitle" class="mt-1 text-sm text-ink-subtle">{{ subtitle }}</p>
  </header>
</template>
