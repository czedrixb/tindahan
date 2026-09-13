<script setup lang="ts">
// A single quiet metric figure: alignment and typography carry the hierarchy
// instead of a tinted card per metric (docs/2026-09-13-pos-redesign.md: "use
// alignment and typography instead of different colored tiles").
defineProps<{
  label: string
  value: string
  caption?: string
}>()
</script>

<template>
  <div data-testid="stat-tile">
    <p class="text-xs font-medium uppercase tracking-wide text-ink-subtle">{{ label }}</p>
    <p class="mt-1 text-2xl font-bold leading-tight tabular-nums text-ink">{{ value }}</p>
    <p v-if="caption" class="mt-0.5 text-xs text-ink-subtle">{{ caption }}</p>
  </div>
</template>
