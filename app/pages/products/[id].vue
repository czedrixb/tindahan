<script setup lang="ts">
import type { Product } from '~/types'

const route = useRoute()
const id = Number(route.params.id)
const toast = useToast()
const { confirm } = useConfirm()

const { data: product, refresh } = await useFetch<Product>(`/api/products/${id}`)

const name = ref('')
const variant = ref('')
const costPesos = ref<number | null>(null)
const sellingPesos = ref<number | null>(null)
const lowStockThreshold = ref(5)
const savingDetails = ref(false)
const message = ref('')

function syncForm() {
  if (!product.value) return
  name.value = product.value.name
  variant.value = product.value.variant
  costPesos.value = product.value.costPrice === null ? null : centavosToPesos(product.value.costPrice)
  sellingPesos.value = product.value.sellingPrice === null ? null : centavosToPesos(product.value.sellingPrice)
  lowStockThreshold.value = product.value.lowStockThreshold
}
watch(product, syncForm, { immediate: true })

async function saveDetails() {
  savingDetails.value = true
  message.value = ''
  try {
    await $fetch(`/api/products/${id}`, {
      method: 'PATCH',
      body: {
        name: name.value,
        variant: variant.value,
        costPrice: costPesos.value === null ? null : pesosToCentavos(costPesos.value),
        sellingPrice: sellingPesos.value === null ? null : pesosToCentavos(sellingPesos.value),
        lowStockThreshold: lowStockThreshold.value,
      },
    })
    await refresh()
    // The inline banner below already confirms success; a toast with
    // overlapping wording would just double up the same message on screen.
    message.value = 'Saved.'
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err, 'Could not save'))
  } finally {
    savingDetails.value = false
  }
}

// Restock
const restockQty = ref<number | null>(null)
const restocking = ref(false)
async function restock() {
  if (!restockQty.value || restockQty.value <= 0) return
  restocking.value = true
  try {
    await $fetch(`/api/products/${id}/restock`, { method: 'POST', body: { quantity: restockQty.value } })
    restockQty.value = null
    await refresh()
    message.value = 'Stock received.'
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err, 'Could not receive stock'))
  } finally {
    restocking.value = false
  }
}

// Adjustment
const adjustType = ref<'DAMAGE' | 'EXPIRED' | 'MISSING' | 'ADJUSTMENT'>('DAMAGE')
const adjustQty = ref<number | null>(null)
const adjustReason = ref('')
const adjusting = ref(false)
async function adjust() {
  if (!adjustQty.value || adjustQty.value === 0 || !adjustReason.value.trim() || !product.value) return

  const delta = adjustType.value === 'ADJUSTMENT' ? adjustQty.value : -Math.abs(adjustQty.value)
  if (delta < 0) {
    const ok = await confirm({
      title: 'Record this stock adjustment?',
      body: `Stock on ${product.value.name} goes from ${product.value.stock} to ${product.value.stock + delta}. This is written to the audit log as ${adjustType.value}.`,
      confirmLabel: 'Record adjustment',
      tone: 'warn',
    })
    if (!ok) return
  }

  adjusting.value = true
  try {
    await $fetch(`/api/products/${id}/adjust`, {
      method: 'POST',
      body: { type: adjustType.value, delta, reason: adjustReason.value.trim() },
    })
    adjustQty.value = null
    adjustReason.value = ''
    await refresh()
    message.value = 'Adjustment recorded.'
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err, 'Could not record adjustment'))
  } finally {
    adjusting.value = false
  }
}

const deactivating = ref(false)
async function deactivate() {
  if (!product.value) return
  const ok = await confirm({
    title: `Deactivate ${product.value.name}?`,
    body: `${product.value.name} stops appearing in checkout and inventory. Past sales and stock history stay in the audit log.`,
    confirmLabel: 'Deactivate product',
    tone: 'danger',
  })
  if (!ok) return

  deactivating.value = true
  try {
    await $fetch(`/api/products/${id}`, { method: 'DELETE' })
    toast.success(`${product.value.name} deactivated.`)
    await navigateTo('/inventory')
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err, 'Could not deactivate product'))
    deactivating.value = false
  }
}
</script>

<template>
  <div v-if="product">
    <PageHeader :title="product.name" :subtitle="product.variant || undefined" />

    <div class="page-shell page-shell--form space-y-6">
      <p v-if="message" class="rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">{{ message }}</p>

      <AppCard>
        <h2 class="mb-3 text-sm font-semibold text-ink-muted">Details</h2>
        <div class="space-y-3">
          <AppField label="Product Name" for="detail-name">
            <input id="detail-name" v-model="name" type="text" class="field-input" />
          </AppField>
          <AppField label="Variant" for="detail-variant">
            <input id="detail-variant" v-model="variant" type="text" class="field-input" />
          </AppField>
          <div class="grid grid-cols-2 gap-3">
            <AppField label="Cost Price (₱)" for="detail-cost">
              <input id="detail-cost" v-model.number="costPesos" type="number" min="0" step="0.01" class="field-input" />
            </AppField>
            <AppField label="Selling Price (₱)" for="detail-selling">
              <input id="detail-selling" v-model.number="sellingPesos" type="number" min="0" step="0.01" class="field-input" />
            </AppField>
          </div>
          <AppField label="Low Stock Threshold" for="detail-threshold">
            <input id="detail-threshold" v-model.number="lowStockThreshold" type="number" min="0" class="field-input" />
          </AppField>
          <AppButton block size="sm" :loading="savingDetails" @click="saveDetails">
            {{ savingDetails ? 'Saving' : 'Save Details' }}
          </AppButton>
        </div>
      </AppCard>

      <AppCard>
        <h2 class="mb-1 text-sm font-semibold text-ink-muted">Current Stock</h2>
        <p class="text-3xl font-bold tabular-nums text-ink">{{ product.stock }}</p>
      </AppCard>

      <AppCard>
        <h2 class="mb-3 text-sm font-semibold text-ink-muted">Receive Stock</h2>
        <div class="flex gap-2">
          <input
            v-model.number="restockQty"
            type="number"
            min="1"
            placeholder="Quantity received"
            class="field-input flex-1"
          />
          <AppButton size="sm" :loading="restocking" :disabled="!restockQty" @click="restock">
            + Add
          </AppButton>
        </div>
      </AppCard>

      <AppCard>
        <h2 class="mb-3 text-sm font-semibold text-ink-muted">Inventory Adjustment</h2>
        <div class="space-y-2">
          <select v-model="adjustType" class="field-input text-sm">
            <option value="DAMAGE">Damaged</option>
            <option value="EXPIRED">Expired</option>
            <option value="MISSING">Missing</option>
            <option value="ADJUSTMENT">Manual Adjustment (+/-)</option>
          </select>
          <input
            v-model.number="adjustQty"
            type="number"
            :placeholder="adjustType === 'ADJUSTMENT' ? 'Change (e.g. -2 or 3)' : 'Quantity'"
            class="field-input"
          />
          <input v-model="adjustReason" type="text" placeholder="Reason" class="field-input" />
          <AppButton variant="secondary" block size="sm" :loading="adjusting" @click="adjust">
            Save Adjustment
          </AppButton>
        </div>
      </AppCard>

      <AppButton variant="danger" block :loading="deactivating" @click="deactivate">
        Deactivate Product
      </AppButton>
    </div>
  </div>
</template>
