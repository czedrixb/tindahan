<script setup lang="ts">
import { PhCaretLeft, PhCaretRight } from '@phosphor-icons/vue'

const props = defineProps<{
  page: number
  totalItems: number
  pageSize: number
  label?: string
}>()

const emit = defineEmits<{ change: [page: number] }>()
const totalPages = computed(() => Math.max(1, Math.ceil(props.totalItems / props.pageSize)))
const pages = computed<(number | 'ellipsis')[]>(() => {
  const total = totalPages.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const values = new Set([1, total, props.page - 1, props.page, props.page + 1])
  const sorted = [...values].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)
  const result: (number | 'ellipsis')[] = []
  for (const page of sorted) {
    const previous = result[result.length - 1]
    if (typeof previous === 'number' && page - previous > 1) result.push('ellipsis')
    result.push(page)
  }
  return result
})
</script>

<template>
  <nav
    v-if="totalPages > 1"
    class="mt-3 flex items-center justify-between gap-2"
    :aria-label="label ?? 'Pagination'"
    data-testid="pagination"
  >
    <button
      type="button"
      class="press focus-ring inline-flex min-h-10 items-center gap-1 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="page <= 1"
      aria-label="Previous page"
      @click="emit('change', page - 1)"
    >
      <PhCaretLeft class="h-4 w-4" weight="bold" aria-hidden="true" />
      <span class="hidden sm:inline">Previous</span>
    </button>

    <div class="flex items-center gap-1">
      <template v-for="(item, index) in pages" :key="`${item}-${index}`">
        <span v-if="item === 'ellipsis'" class="px-1 text-sm text-ink-subtle" aria-hidden="true">â€¦</span>
        <button
          v-else
          type="button"
          class="press focus-ring min-h-10 min-w-10 rounded-[var(--radius-control)] px-2 text-sm font-semibold"
          :class="item === page ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-neutral-100'"
          :aria-current="item === page ? 'page' : undefined"
          :aria-label="`Page ${item}`"
          @click="emit('change', item)"
        >
          {{ item }}
        </button>
      </template>
    </div>

    <button
      type="button"
      class="press focus-ring inline-flex min-h-10 items-center gap-1 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="page >= totalPages"
      aria-label="Next page"
      @click="emit('change', page + 1)"
    >
      <span class="hidden sm:inline">Next</span>
      <PhCaretRight class="h-4 w-4" weight="bold" aria-hidden="true" />
    </button>
  </nav>
</template>
