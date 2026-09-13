<script setup lang="ts">
import { PhMagnifyingGlass, PhPackage, PhPlus, PhX } from '@phosphor-icons/vue'
import type { Product } from '~/types'

const toast = useToast()

const search = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const lowStockOnly = ref(false)
const products = ref<Product[]>([])
const loading = ref(false)
const error = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined
let latestRequest = 0

async function load() {
  const requestId = ++latestRequest
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  error.value = ''
  try {
    const result = await $fetch<Product[]>('/api/products', {
      signal: controller.signal,
      query: {
        active: 'true',
        q: search.value.trim() || undefined,
        lowStock: lowStockOnly.value ? 'true' : undefined,
      },
    })
    if (requestId === latestRequest) products.value = result
  } catch (err: unknown) {
    if (requestId !== latestRequest || (err instanceof DOMException && err.name === 'AbortError')) return
    error.value = apiErrorMessage(err, 'Could not load inventory')
    toast.error(error.value)
  } finally {
    if (requestId === latestRequest) loading.value = false
  }
}

watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(load, 200)
})
watch(lowStockOnly, load)
onMounted(load)
onBeforeUnmount(() => {
  clearTimeout(timer)
  controller?.abort()
})

// Amber-with-text-cue only (docs/2026-09-13-pos-redesign.md reserves amber for
// low stock, red for errors/destructive actions - "Low" used to render in
// text-danger-600, which is now reserved for the latter).
function isLowStock(p: Product) {
  return p.stock <= p.lowStockThreshold
}

function clearSearch() {
  search.value = ''
  searchInput.value?.focus()
}
</script>

<template>
  <div>
    <PageHeader title="Inventory">
      <template #actions>
        <NuxtLink
          to="/products/new"
          class="focus-ring relative z-10 flex min-h-11 shrink-0 touch-manipulation items-center gap-1 rounded-[var(--radius-control)] px-2 text-sm font-semibold text-brand-600 active:bg-brand-50 lg:hidden"
          @touchend.prevent="navigateTo('/products/new')"
        >
          <PhPlus class="h-4 w-4" weight="bold" />
          Add Product
        </NuxtLink>
      </template>
    </PageHeader>

    <div class="page-shell space-y-3">
      <div class="sticky-search -mx-4 space-y-3 border-b border-line bg-surface-sunken px-4 pt-3 pb-3 lg:static lg:mx-0 lg:flex lg:items-center lg:justify-between lg:gap-4 lg:space-y-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:pb-0">
        <div class="flex items-center gap-4 lg:flex-1">
          <div class="relative flex-1">
            <PhMagnifyingGlass class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
            <input
              ref="searchInput"
              v-model="search"
              type="search"
              placeholder="Search inventory..."
              class="field-input field-input--with-leading-icon pr-12"
            />
            <button
              v-show="search.length"
              type="button"
              class="focus-ring absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full text-ink-muted active:bg-neutral-100"
              aria-label="Clear inventory search"
              @click="clearSearch"
            >
              <PhX class="h-5 w-5" weight="bold" aria-hidden="true" />
            </button>
          </div>

          <label class="hidden shrink-0 items-center gap-2 text-sm text-ink-muted lg:flex">
            <input v-model="lowStockOnly" type="checkbox" class="h-4 w-4 rounded border-line-strong text-brand-600 focus-ring" />
            Low stock only
          </label>
        </div>

        <label class="flex items-center gap-2 text-sm text-ink-muted lg:hidden">
          <input v-model="lowStockOnly" type="checkbox" class="h-4 w-4 rounded border-line-strong text-brand-600 focus-ring" />
          Low stock only
        </label>

        <NuxtLink
          to="/products/new"
          class="focus-ring hidden shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-brand-700 lg:flex"
        >
          <PhPlus class="h-4 w-4" weight="bold" />
          Add Product
        </NuxtLink>
      </div>

      <AppSkeleton v-if="loading" variant="list" />
      <div v-else-if="error" class="space-y-2 rounded-[var(--radius-card)] border border-danger-200 bg-danger-50 p-4 text-sm text-danger-600">
        <p>{{ error }}</p>
        <AppButton size="sm" variant="secondary" @click="load">Try again</AppButton>
      </div>
      <AppEmpty v-else-if="!products.length" :icon="PhPackage" message="No products found." />

      <template v-else>
        <ul class="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface lg:hidden">
          <li v-for="(p, i) in products" :key="p.id" class="list-enter-item" :style="{ '--i': i }">
            <NuxtLink
              :to="`/products/${p.id}`"
              class="focus-ring relative z-10 flex touch-manipulation items-center justify-between px-4 py-3 active:bg-neutral-50"
              @touchend.prevent="navigateTo(`/products/${p.id}`)"
            >
              <div>
                <p class="font-medium text-ink">{{ p.name }}<span v-if="p.variant" class="text-ink-subtle"> · {{ p.variant }}</span></p>
                <p v-if="p.costPrice === null || p.sellingPrice === null" class="text-xs text-warn-600">Needs pricing</p>
              </div>
              <div class="text-right">
                <p class="font-semibold tabular-nums text-ink">{{ p.sellingPrice !== null ? formatPeso(p.sellingPrice) : '—' }}</p>
                <p class="text-xs tabular-nums" :class="isLowStock(p) ? 'font-semibold text-warn-700' : 'text-ink-subtle'">
                  {{ p.stock }} in stock<span v-if="isLowStock(p)"> · Low</span>
                </p>
              </div>
            </NuxtLink>
          </li>
        </ul>

        <div class="hidden overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface lg:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-ink-subtle">
                <th class="px-4 py-3 font-medium">Product</th>
                <th class="px-4 py-3 font-medium">Variant</th>
                <th class="px-4 py-3 text-right font-medium">In stock</th>
                <th class="px-4 py-3 text-right font-medium">Cost</th>
                <th class="px-4 py-3 text-right font-medium">Selling price</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="p in products" :key="p.id">
                <td class="px-4 py-3 font-medium text-ink">
                  <NuxtLink :to="`/products/${p.id}`" class="focus-ring rounded hover:text-brand-700">{{ p.name }}</NuxtLink>
                  <p v-if="p.costPrice === null || p.sellingPrice === null" class="text-xs font-normal text-warn-600">Needs pricing</p>
                </td>
                <td class="px-4 py-3 text-ink-subtle">{{ p.variant || '—' }}</td>
                <td class="px-4 py-3 text-right tabular-nums" :class="isLowStock(p) ? 'font-semibold text-warn-700' : 'text-ink'">
                  {{ p.stock }}<span v-if="isLowStock(p)" class="ml-1.5 text-xs font-normal">Low</span>
                </td>
                <td class="px-4 py-3 text-right tabular-nums text-ink-subtle">{{ p.costPrice !== null ? formatPeso(p.costPrice) : '—' }}</td>
                <td class="px-4 py-3 text-right tabular-nums text-ink">{{ p.sellingPrice !== null ? formatPeso(p.sellingPrice) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>
