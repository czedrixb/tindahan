<script setup lang="ts">
import type { DashboardSummary } from '~/types'

const { data, refresh, pending, error } = useLazyFetch<DashboardSummary>('/api/dashboard/today')
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
                v-for="(p, i) in data.lowStock"
                :key="p.id"
                class="list-enter-item flex items-center justify-between px-4 py-3"
                :style="{ '--i': i }"
              >
                <div>
                  <p class="font-medium text-ink">{{ p.name }}<span v-if="p.variant" class="text-ink-subtle"> · {{ p.variant }}</span></p>
                  <p class="text-xs"><span class="font-semibold text-warn-700">{{ p.stock }}</span> <span class="text-ink-subtle">remaining</span></p>
                </div>
                <NuxtLink :to="`/products/${p.id}`" class="press focus-ring rounded-[var(--radius-control)] border border-line px-3 py-1.5 text-xs font-semibold text-ink">
                  Restock
                </NuxtLink>
              </li>
            </ul>
          </section>

          <section>
            <div class="mb-2 flex items-center justify-between">
              <h2 class="text-sm font-semibold text-ink-muted">Recent sales</h2>
              <NuxtLink to="/sales" class="focus-ring rounded text-xs font-semibold text-brand-600">View all</NuxtLink>
            </div>
            <ul v-if="data.recentSales?.length" class="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              <li v-for="sale in data.recentSales" :key="sale.id" class="flex items-center justify-between px-4 py-3 text-sm">
                <span class="text-ink-subtle">{{ formatTimeLabel(sale.soldAt) }}</span>
                <span class="font-semibold tabular-nums text-ink">{{ formatPeso(sale.revenue) }}</span>
              </li>
            </ul>
            <AppEmpty v-else message="No sales recorded yet today." />
          </section>
        </div>
      </template>
    </div>
  </div>
</template>
