<script setup lang="ts">
import type { DashboardSummary } from '~/types'

const { data, refresh, pending, error } = useLazyFetch<DashboardSummary>('/api/dashboard/today')

const lowStock = computed(() => data.value?.lowStock ?? [])
const recentSales = computed(() => data.value?.recentSales ?? [])
const lowStockPager = usePagination(lowStock, 5)
const recentSalesPager = usePagination(recentSales, 5)
</script>

<template>
  <div>
    <HomeHeader title="Today" :subtitle="data ? formatDateLabel(data.date) : undefined" />

    <div class="page-shell space-y-6">
      <AppSkeleton v-if="pending && !data" variant="stat-grid" />

      <div v-else-if="error" class="space-y-3 rounded-[var(--radius-card)] border border-danger-200 bg-danger-50 p-4 text-sm text-danger-600">
        <p>Could not load today’s summary.</p>
        <AppButton size="sm" variant="secondary" @click="refresh()">Try again</AppButton>
      </div>

      <template v-else-if="data">
        <div class="flex items-start justify-between gap-4">
          <div class="grid grow grid-cols-2 gap-4 lg:flex lg:items-start lg:gap-10">
            <StatTile label="Sales" :value="formatPeso(data.revenue)" />
            <StatTile label="Cost" :value="formatPeso(data.cost)" />
            <StatTile label="Profit" :value="formatPeso(data.profit)" />
            <StatTile label="Transactions" :value="String(data.transactions)" />
          </div>
          <NuxtLink
            to="/sales/new"
            class="press focus-ring shrink-0 rounded-[var(--radius-control)] bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-brand-700"
          >
            New sale
          </NuxtLink>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <section v-if="data.lowStock.length">
            <h2 class="mb-2 text-sm font-semibold text-ink-muted">Needs restocking</h2>
            <ul class="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              <li
                v-for="(p, i) in lowStockPager.pageItems.value"
                :key="p.id"
                class="list-enter-item flex items-center justify-between px-4 py-3"
                :style="{ '--i': i }"
              >
                <div>
                  <p class="font-medium text-ink">{{ formatProductText(p.name) }}<span v-if="p.variant" class="text-ink-subtle"> · {{ formatProductText(p.variant) }}</span></p>
                  <p class="text-xs"><span class="font-semibold text-warn-700">{{ p.stock }}</span> <span class="text-ink-subtle">remaining</span></p>
                </div>
                <NuxtLink :to="`/products/${p.id}`" class="press focus-ring rounded-[var(--radius-control)] border border-line px-3 py-1.5 text-xs font-semibold text-ink">
                  Restock
                </NuxtLink>
              </li>
            </ul>
            <AppPagination
              :page="lowStockPager.currentPage.value"
              :total-items="lowStock.length"
              :page-size="5"
              label="Needs restocking pages"
              @change="lowStockPager.setPage"
            />
          </section>

          <section>
            <div class="mb-2 flex items-center justify-between">
              <h2 class="text-sm font-semibold text-ink-muted">Recent sales</h2>
              <NuxtLink to="/sales" class="focus-ring rounded text-xs font-semibold text-brand-600">View all</NuxtLink>
            </div>
            <ul v-if="data.recentSales?.length" class="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              <li v-for="sale in recentSalesPager.pageItems.value" :key="sale.id" class="px-4 py-3 text-sm">
                <div v-for="line in sale.lines" :key="line.id" class="flex items-start justify-between gap-3 py-0.5">
                  <span class="text-ink">{{ formatProductText(line.productName) }}<span v-if="line.productVariant" class="text-ink-subtle"> · {{ formatProductText(line.productVariant) }}</span></span>
                  <span class="shrink-0 font-medium tabular-nums text-ink-muted">×{{ line.quantity }}</span>
                </div>
                <div class="mt-1.5 flex items-center justify-between border-t border-line pt-1.5">
                  <span class="text-xs text-ink-subtle">{{ formatTimeLabel(sale.soldAt) }}</span>
                  <span class="font-semibold tabular-nums text-ink">{{ formatPeso(sale.revenue) }}</span>
                </div>
              </li>
            </ul>
            <AppEmpty v-else message="No sales recorded yet today." />
            <AppPagination
              v-if="recentSales.length"
              :page="recentSalesPager.currentPage.value"
              :total-items="recentSales.length"
              :page-size="5"
              label="Recent sales pages"
              @change="recentSalesPager.setPage"
            />
          </section>
        </div>
      </template>
    </div>
  </div>
</template>
