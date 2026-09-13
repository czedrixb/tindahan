<script setup lang="ts">
import { PhClockCounterClockwise } from '@phosphor-icons/vue'

definePageMeta({ middleware: 'admin' })

interface AuditEntry {
  id: number
  action: string
  entityType: string
  entityId: string | null
  description: string
  createdAt: string
  username: string
  displayName: string
}

const { data: entries, status } = await useFetch<AuditEntry[]>('/api/audit')

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
</script>

<template>
  <div>
    <PageHeader title="Audit Log" subtitle="Who did what, and when" />
    <div class="page-shell page-shell--form">
      <AppSkeleton v-if="status === 'pending'" variant="list" />
      <AppEmpty v-else-if="!entries?.length" :icon="PhClockCounterClockwise" message="No activity recorded yet." />
      <ol v-else class="space-y-3" data-testid="audit-log">
        <li v-for="(entry, i) in entries" :key="entry.id" class="list-enter-item rounded-[var(--radius-card)] border border-line bg-surface p-4" :style="{ '--i': i }">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-medium text-ink">{{ entry.description }}</p>
              <p class="mt-1 text-sm font-semibold text-brand-700" data-testid="audit-actor">
                {{ entry.displayName }} <span class="font-normal text-ink-subtle">@{{ entry.username }}</span>
              </p>
            </div>
            <AppBadge tone="neutral">{{ entry.action }}</AppBadge>
          </div>
          <time class="mt-2 block text-xs text-ink-subtle" :datetime="entry.createdAt">{{ formatTime(entry.createdAt) }}</time>
        </li>
      </ol>
    </div>
  </div>
</template>
