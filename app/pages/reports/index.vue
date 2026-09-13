<script setup lang="ts">
import { PhFileXls } from '@phosphor-icons/vue'
import type { DailySalesPoint, MonthlyReport, SalesTotals, TopProduct, WeeklyReport } from '~/types'

const toast = useToast()

const tab = ref<'daily' | 'weekly' | 'monthly'>('daily')

const daily = ref<(SalesTotals & { date: string }) | null>(null)
const weekly = ref<WeeklyReport | null>(null)
const monthly = ref<MonthlyReport | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    if (tab.value === 'daily') daily.value = await $fetch('/api/reports/daily')
    else if (tab.value === 'weekly') weekly.value = await $fetch('/api/reports/weekly')
    else monthly.value = await $fetch('/api/reports/monthly')
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err, 'Could not load this report'))
  } finally {
    loading.value = false
  }
}

watch(tab, load)
onMounted(load)

const RANGE_PARAM = { daily: 'today', weekly: 'week', monthly: 'month' } as const
const exportHref = computed(() => `/api/export/sales?range=${RANGE_PARAM[tab.value]}`)

const rangeLabel = computed(() => {
  if (tab.value === 'daily') return daily.value ? formatDateLabel(daily.value.date) : ''
  if (tab.value === 'weekly') return weekly.value ? `${formatDateLabel(weekly.value.start)} – ${formatDateLabel(weekly.value.end)}` : ''
  return monthly.value ? `${formatDateLabel(monthly.value.start)} – ${formatDateLabel(monthly.value.end)}` : ''
})

const totals = computed<SalesTotals | null>(() => {
  if (tab.value === 'daily') return daily.value
  if (tab.value === 'weekly') return weekly.value
  return monthly.value
})

// Only weekly/monthly reports carry a per-day series and a product breakdown
// with revenue - a single day has nothing to chart or rank (server/utils/sales-report.ts).
const series = computed<DailySalesPoint[]>(() => {
  if (tab.value === 'weekly') return weekly.value?.series ?? []
  if (tab.value === 'monthly') return monthly.value?.series ?? []
  return []
})
const topProducts = computed<TopProduct[]>(() => {
  if (tab.value === 'weekly') return weekly.value?.topProducts ?? []
  if (tab.value === 'monthly') return monthly.value?.topProducts ?? []
  return []
})
const lowestStock = computed(() => monthly.value?.lowestStock ?? [])

const CHART_W = 100
const CHART_H = 36
const chartMax = computed(() => Math.max(1, ...series.value.map((p) => p.revenue)))

function barSlotWidth() {
  return series.value.length ? CHART_W / series.value.length : 0
}
function barX(i: number) {
  return i * barSlotWidth() + barSlotWidth() * 0.22
}
function barWidth() {
  return barSlotWidth() * 0.56
}
function barHeight(revenue: number) {
  return (revenue / chartMax.value) * CHART_H
}
function barY(revenue: number) {
  return CHART_H - barHeight(revenue)
}
function dayLabel(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+08:00`).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <div>
    <PageHeader title="Reports">
      <template #actions>
        <a
          :href="exportHref"
          class="press focus-ring flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-[var(--radius-control)] border border-line px-3 text-sm font-semibold text-ink active:bg-neutral-50"
        >
          <PhFileXls class="h-4 w-4" weight="bold" />
          Export
        </a>
      </template>
    </PageHeader>

    <div class="page-shell space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex gap-2">
          <button
            v-for="t in (['daily', 'weekly', 'monthly'] as const)"
            :key="t"
            type="button"
            class="press focus-ring rounded-[var(--radius-pill)] px-3 py-1.5 text-sm font-medium capitalize"
            :class="tab === t ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-ink-muted'"
            @click="tab = t"
          >
            {{ t }}
          </button>
        </div>
        <p v-if="rangeLabel" class="hidden text-sm text-ink-subtle sm:block">{{ rangeLabel }}</p>
      </div>
      <p v-if="rangeLabel" class="-mt-2 text-sm text-ink-subtle sm:hidden">{{ rangeLabel }}</p>

      <AppSkeleton v-if="loading" variant="stat-grid" />

      <template v-else-if="totals">
        <div class="flex flex-wrap gap-8 border-b border-line pb-4">
          <StatTile label="Sales" :value="formatPeso(totals.revenue)" />
          <StatTile label="Cost" :value="formatPeso(totals.cost)" />
          <StatTile label="Profit" :value="formatPeso(totals.profit)" />
        </div>

        <div v-if="series.length || topProducts.length" class="grid gap-6 lg:grid-cols-2">
          <section v-if="series.length" class="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <h2 class="mb-3 text-sm font-semibold text-ink-muted">Daily sales</h2>
            <svg
              :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
              preserveAspectRatio="none"
              class="h-32 w-full"
              role="img"
              :aria-label="`Daily sales, ${rangeLabel}`"
            >
              <rect
                v-for="(p, i) in series"
                :key="p.date"
                :x="barX(i)"
                :y="barY(p.revenue)"
                :width="barWidth()"
                :height="Math.max(barHeight(p.revenue), 0.5)"
                rx="1"
                fill="var(--color-brand-600)"
              />
            </svg>
            <div class="mt-1 grid text-center text-[10px] text-ink-subtle" :style="{ gridTemplateColumns: `repeat(${series.length}, 1fr)` }">
              <span v-for="p in series" :key="p.date">{{ dayLabel(p.date) }}</span>
            </div>
            <ul class="sr-only">
              <li v-for="p in series" :key="p.date">{{ dayLabel(p.date) }}: {{ formatPeso(p.revenue) }}</li>
            </ul>
          </section>

          <section v-if="topProducts.length">
            <h2 class="mb-2 text-sm font-semibold text-ink-muted">Best sellers</h2>
            <div class="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-ink-subtle">
                    <th class="px-4 py-2.5 font-medium">Product</th>
                    <th class="px-4 py-2.5 text-right font-medium">Units sold</th>
                    <th class="px-4 py-2.5 text-right font-medium">Sales</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-line">
                  <tr v-for="p in topProducts" :key="p.productId">
                    <td class="px-4 py-2.5 text-ink">{{ p.name }}<span v-if="p.variant" class="text-ink-subtle"> · {{ p.variant }}</span></td>
                    <td class="px-4 py-2.5 text-right tabular-nums text-ink">{{ p.quantitySold }}</td>
                    <td class="px-4 py-2.5 text-right tabular-nums text-ink">{{ formatPeso(p.revenue) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section v-if="lowestStock.length">
          <h2 class="mb-2 text-sm font-semibold text-ink-muted">Lowest-stock products</h2>
          <ul class="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            <li v-for="p in lowestStock" :key="p.id" class="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{{ p.name }}<span v-if="p.variant" class="text-ink-subtle"> · {{ p.variant }}</span></span>
              <span class="font-medium tabular-nums text-ink">{{ p.stock }}</span>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>
