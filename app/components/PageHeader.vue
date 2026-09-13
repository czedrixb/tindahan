<script setup lang="ts">
const props = defineProps<{
  title: string
  subtitle?: string
}>()

// Every page renders exactly one PageHeader or HomeHeader, so this is the
// single place that sets the "Page name · Tindahan" document title instead
// of repeating useHead in each of the ~15 pages.
useHead({ title: () => props.title })
</script>

<template>
  <header class="safe-top sticky top-0 z-30 rounded-b-[var(--radius-card)] border-b border-line bg-surface px-4 pb-4 [--safe-pt:1.25rem] lg:rounded-none lg:px-8">
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-lg font-bold text-ink">{{ title }}</h1>
        <p v-if="subtitle" class="text-sm text-ink-subtle">{{ subtitle }}</p>
      </div>
      <slot name="actions" />
    </div>
  </header>
</template>
