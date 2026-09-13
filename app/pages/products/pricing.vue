<script setup lang="ts">
import { PhTag } from '@phosphor-icons/vue'
import type { Product } from '~/types'

const toast = useToast()

const products = ref<Product[]>([])
const drafts = reactive<Record<number, { cost: number | null; selling: number | null }>>({})
const savingId = ref<number | null>(null)

async function load() {
  const rows = await $fetch<Product[]>('/api/products', { query: { needsPricing: 'true', active: 'true' } })
  products.value = rows
  for (const p of rows) {
    drafts[p.id] = { cost: null, selling: null }
  }
}
onMounted(load)

async function save(product: Product) {
  const draft = drafts[product.id]
  if (draft.cost === null || draft.selling === null) return
  savingId.value = product.id
  try {
    await $fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      body: {
        costPrice: pesosToCentavos(draft.cost),
        sellingPrice: pesosToCentavos(draft.selling),
      },
    })
    products.value = products.value.filter((p) => p.id !== product.id)
    toast.success(`${product.name} priced.`)
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err, 'Could not save pricing'))
  } finally {
    savingId.value = null
  }
}
</script>

<template>
  <div>
    <PageHeader title="Needs Pricing" :subtitle="`${products.length} product${products.length === 1 ? '' : 's'}`" />

    <div class="page-shell page-shell--form">
      <AppEmpty v-if="!products.length" :icon="PhTag" message="All products are priced." />

      <ul v-else class="space-y-3">
        <li v-for="p in products" :key="p.id" class="rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <p class="font-medium text-ink">{{ p.name }}<span v-if="p.variant" class="text-ink-subtle"> · {{ p.variant }}</span></p>
          <p class="text-xs text-ink-subtle">Stock: {{ p.stock }}</p>
          <div class="mt-2 flex gap-2">
            <input
              v-model.number="drafts[p.id].cost"
              type="number"
              min="0"
              step="0.01"
              placeholder="Cost ₱"
              class="field-input w-24 px-2 py-1.5 text-sm"
            />
            <input
              v-model.number="drafts[p.id].selling"
              type="number"
              min="0"
              step="0.01"
              placeholder="Sell ₱"
              class="field-input w-24 px-2 py-1.5 text-sm"
            />
            <AppButton
              size="sm"
              class="flex-1"
              :loading="savingId === p.id"
              :disabled="drafts[p.id].cost === null || drafts[p.id].selling === null"
              @click="save(p)"
            >
              Save
            </AppButton>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
