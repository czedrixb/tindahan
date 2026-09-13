<script setup lang="ts">
import { PhFileXls } from '@phosphor-icons/vue'
import type { InventoryCountDetail } from '~/types'

const route = useRoute()
const id = Number(route.params.id)
const toast = useToast()
const { confirm } = useConfirm()

const { data: count, refresh } = await useFetch<InventoryCountDetail>(`/api/counts/${id}`)
const completing = ref(false)
const savingItemId = ref<number | null>(null)

async function saveActual(itemId: number, value: number | null) {
  if (value === null || value < 0 || !Number.isInteger(value)) return
  savingItemId.value = itemId
  try {
    await $fetch(`/api/counts/${id}/items/${itemId}`, { method: 'PATCH', body: { actualQuantity: value } })
    await refresh()
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err, 'Could not save the counted quantity'))
  } finally {
    savingItemId.value = null
  }
}

async function completeCount() {
  if (!count.value) return
  const remaining = count.value.items.length - countedItems.value
  const ok = await confirm({
    title: 'Save count and apply adjustments?',
    body: `${countedItems.value} product${countedItems.value === 1 ? '' : 's'} will be adjusted to their counted quantity.${remaining ? ` ${remaining} uncounted product${remaining === 1 ? '' : 's'} will be left as-is.` : ''} This cannot be undone.`,
    confirmLabel: 'Save and apply',
    tone: 'warn',
  })
  if (!ok) return

  completing.value = true
  try {
    await $fetch(`/api/counts/${id}/complete`, { method: 'POST' })
    await refresh()
    toast.success('Count saved and stock adjusted.')
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err, 'Could not complete the count'))
  } finally {
    completing.value = false
  }
}

const isInProgress = computed(() => count.value?.status === 'IN_PROGRESS')
const countedItems = computed(() => count.value?.items.filter((i) => i.actualQuantity !== null).length ?? 0)
</script>

<template>
  <div v-if="count">
    <PageHeader title="Inventory Count" :subtitle="formatDateLabel(count.countDate)" />

    <div class="page-shell space-y-4">
      <div class="flex items-center justify-between rounded-[var(--radius-control)] bg-surface-sunken px-4 py-3 text-sm">
        <span class="text-ink-muted">{{ countedItems }} / {{ count.items.length }} counted</span>
        <AppBadge :tone="count.status === 'COMPLETED' ? 'neutral' : 'brand'">
          {{ count.status === 'COMPLETED' ? 'Completed' : 'In Progress' }}
        </AppBadge>
      </div>

      <div class="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <table class="w-full text-sm">
          <thead class="bg-surface-sunken text-left text-xs uppercase text-ink-subtle">
            <tr>
              <th class="px-3 py-2">Product</th>
              <th class="px-3 py-2 text-right">Expected</th>
              <th class="px-3 py-2 text-right">Actual</th>
              <th class="px-3 py-2 text-right">Diff</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="item in count.items" :key="item.id">
              <td class="px-3 py-2">
                {{ item.productName }}<span v-if="item.productVariant" class="text-ink-subtle"> · {{ item.productVariant }}</span>
              </td>
              <td class="px-3 py-2 text-right tabular-nums">{{ item.expectedQuantity }}</td>
              <td class="px-3 py-2 text-right">
                <input
                  v-if="isInProgress"
                  type="number"
                  min="0"
                  class="field-input w-16 px-1 py-1 text-right tabular-nums"
                  :value="item.actualQuantity ?? ''"
                  :disabled="savingItemId === item.id"
                  data-testid="count-actual-input"
                  @change="saveActual(item.id, ($event.target as HTMLInputElement).valueAsNumber)"
                />
                <span v-else class="tabular-nums">{{ item.actualQuantity ?? 'Not counted' }}</span>
              </td>
              <td
                class="px-3 py-2 text-right tabular-nums font-medium"
                :class="{ 'text-danger-600': (item.difference ?? 0) < 0, 'text-success-600': (item.difference ?? 0) > 0 }"
              >
                {{ item.difference ?? 'Not counted' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AppButton v-if="isInProgress" block :loading="completing" data-testid="complete-count" @click="completeCount">
        {{ completing ? 'Saving' : 'Save Count & Apply Adjustments' }}
      </AppButton>

      <a
        :href="`/api/export/count/${id}`"
        class="press focus-ring flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-line py-3 text-center text-sm font-semibold text-ink"
      >
        <PhFileXls class="h-4 w-4" weight="bold" />
        Export to Excel
      </a>
    </div>
  </div>
</template>
