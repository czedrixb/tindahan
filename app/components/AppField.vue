<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    hint?: string
    error?: string
    for?: string
  }>(),
  { hint: '', error: '', for: undefined },
)
</script>

<template>
  <div class="block text-sm font-medium text-ink-muted">
    <!-- Explicit for/id association only - a <label> wrapping the whole slot
         implicitly associates with every focusable descendant, not just the
         intended field, so a field with a second control alongside the input
         (PasswordField's show/hide toggle) made getByLabel(label) match both. -->
    <label :for="$props.for">{{ label }}</label>
    <div class="mt-1">
      <slot />
    </div>
    <p v-if="error" class="mt-1 text-xs font-medium text-danger-600">{{ error }}</p>
    <p v-else-if="hint" class="mt-1 text-xs text-ink-subtle">{{ hint }}</p>
  </div>
</template>
