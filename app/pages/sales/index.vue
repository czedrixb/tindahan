<script setup lang="ts">
import { PhReceipt } from '@phosphor-icons/vue'
import type { Sale } from '~/types'

const filters = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
] as const

const toast = useToast()
const { confirm } = useConfirm()

const range = ref<(typeof filters)[number]['key']>('today')
const sales = ref<Sale[]>([])
const loading = ref(false)
const voidingId = ref<number | null>(null)

async function load() {
  loading.value = true
  try {
    sales.value = await $fetch<Sale[]>('/api/sales', { query: { range: range.value } })
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err, 'Could not load sales history'))
  } finally {
    loading.value = false
  }
}

watch(range, load)
onMounted(load)

interface Receipt {
  transactionId: number
  soldAt: string
  voidedAt: string | null
  cashReceived: number | null
  changeDue: number | null
  lines: Sale[]
}

const receipts = computed(() => {
  const byTransaction = new Map<number, Receipt>()
  for (const sale of sales.value) {
    let receipt = byTransaction.get(sale.transactionId)
    if (!receipt) {
      receipt = {
        transactionId: sale.transactionId,
        soldAt: sale.soldAt,
        voidedAt: sale.voidedAt,
        cashReceived: sale.cashReceived,
        changeDue: sale.changeDue,
        lines: [],
      }
      byTransaction.set(sale.transactionId, receipt)
    }
    receipt.lines.push(sale)
  }
  return Array.from(byTransaction.values())
})

const groups = computed(() => {
  const byDay = new Map<string, Receipt[]>()
  for (const receipt of receipts.value) {
    const key = formatDateLabel(receipt.soldAt)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(receipt)
  }
  return Array.from(byDay.entries())
})

const totalRevenue = computed(() => sales.value.reduce((sum, s) => sum + s.revenue, 0))
const totalProfit = computed(() => sales.value.reduce((sum, s) => sum + s.profit, 0))

function receiptTotal(receipt: Receipt) {
  return receipt.lines.reduce((sum, l) => sum + l.revenue, 0)
}

async function voidReceipt(receipt: Receipt) {
  const qty = receipt.lines.reduce((sum, l) => sum + l.quantity, 0)
  const ok = await confirm({
    title: 'Void this sale?',
    body: `The ${qty} item${qty === 1 ? '' : 's'} go back into stock and ${formatPeso(receiptTotal(receipt))} stops counting toward revenue.`,
    confirmLabel: 'Void sale',
    tone: 'danger',
  })
  if (!ok) return

  voidingId.value = receipt.transactionId
  try {
    await $fetch(`/api/sales/${receipt.transactionId}`, { method: 'DELETE' })
    toast.success('Sale voided. Stock restored.')
    await load()
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err, 'Could not void sale'))
  } finally {
    voidingId.value = null
  }
}
</script>

<template>
  <div>
    <PageHeader title="Sales History" />

    <div class="page-shell">
      <div class="flex gap-2 overflow-x-auto pb-1">
        <button
          v-for="f in filters"
          :key="f.key"
          type="button"
          class="press focus-ring whitespace-nowrap rounded-[var(--radius-pill)] px-3 py-1.5 text-sm font-medium"
          :class="range === f.key ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-ink-muted'"
          @click="range = f.key"
        >
          {{ f.label }}
        </button>
      </div>

      <div class="mt-4 flex gap-8">
        <StatTile label="Revenue" :value="formatPeso(totalRevenue)" />
        <StatTile label="Profit" :value="formatPeso(totalProfit)" />
      </div>

      <AppSkeleton v-if="loading" variant="list" class="mt-4" />
      <AppEmpty v-else-if="!sales.length" :icon="PhReceipt" message="No sales in this period." />

      <div v-else class="mt-4 space-y-5">
        <section v-for="[day, items] in groups" :key="day">
          <h2 class="mb-2 text-sm font-semibold text-ink-muted">{{ day }}</h2>
          <ul class="space-y-3">
            <li
              v-for="(receipt, i) in items"
              :key="receipt.transactionId"
              class="list-enter-item rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3"
              :class="{ 'opacity-40': receipt.voidedAt }"
              :style="{ '--i': i }"
            >
              <div v-for="line in receipt.lines" :key="line.id" class="flex items-center justify-between py-1">
                <p class="text-sm text-ink">
                  {{ line.productName }}<span v-if="line.productVariant" class="text-ink-subtle"> · {{ line.productVariant }}</span>
                  <span class="text-ink-subtle"> ×{{ line.quantity }}</span>
                </p>
                <span class="tabular-nums text-ink-muted">{{ formatPeso(line.revenue) }}</span>
              </div>

              <div class="mt-2 flex items-center justify-between border-t border-line pt-2">
                <p class="text-xs text-ink-subtle">{{ formatTimeLabel(receipt.soldAt) }}</p>
                <div class="flex items-center gap-2">
                  <span class="font-semibold tabular-nums text-ink">{{ formatPeso(receiptTotal(receipt)) }}</span>
                  <button
                    v-if="!receipt.voidedAt"
                    type="button"
                    class="focus-ring rounded-full px-2 py-1 text-xs font-medium text-danger-600 active:bg-danger-50 disabled:opacity-50"
                    :disabled="voidingId === receipt.transactionId"
                    @click="voidReceipt(receipt)"
                  >
                    {{ voidingId === receipt.transactionId ? 'Voiding' : 'Void' }}
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>
