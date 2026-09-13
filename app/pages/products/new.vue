<script setup lang="ts">
const toast = useToast()

const name = ref('')
const variant = ref('')
const costPesos = ref<number | null>(null)
const sellingPesos = ref<number | null>(null)
const stock = ref(0)
const lowStockThreshold = ref(5)
const saving = ref(false)
const error = ref('')

async function save() {
  if (!name.value.trim()) return
  saving.value = true
  error.value = ''
  try {
    const created = await $fetch<{ id: number }>('/api/products', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        variant: variant.value.trim(),
        costPrice: costPesos.value === null ? null : pesosToCentavos(costPesos.value),
        sellingPrice: sellingPesos.value === null ? null : pesosToCentavos(sellingPesos.value),
        stock: stock.value,
        lowStockThreshold: lowStockThreshold.value,
      },
    })
    toast.success(`${name.value.trim()} added to inventory.`)
    await navigateTo(`/products/${created.id}`)
  } catch (err: unknown) {
    const message = apiErrorMessage(err, 'Could not create product')
    error.value = message
    toast.error(message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Add Product" />

    <div class="page-shell page-shell--form space-y-3">
      <p v-if="error" class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">{{ error }}</p>

      <AppField label="Product Name" for="product-name">
        <input id="product-name" v-model="name" type="text" class="field-input" />
      </AppField>
      <AppField label="Variant" for="product-variant">
        <input id="product-variant" v-model="variant" type="text" class="field-input" />
      </AppField>
      <div class="grid grid-cols-2 gap-3">
        <AppField label="Cost Price (₱)" for="product-cost">
          <input id="product-cost" v-model.number="costPesos" type="number" min="0" step="0.01" class="field-input" />
        </AppField>
        <AppField label="Selling Price (₱)" for="product-selling">
          <input id="product-selling" v-model.number="sellingPesos" type="number" min="0" step="0.01" class="field-input" />
        </AppField>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <AppField label="Starting Stock" for="product-stock">
          <input id="product-stock" v-model.number="stock" type="number" min="0" class="field-input" />
        </AppField>
        <AppField label="Low Stock Threshold" for="product-threshold">
          <input id="product-threshold" v-model.number="lowStockThreshold" type="number" min="0" class="field-input" />
        </AppField>
      </div>

      <AppButton block class="mt-1" :loading="saving" :disabled="!name.trim()" @click="save">
        {{ saving ? 'Saving' : 'Save Product' }}
      </AppButton>
    </div>
  </div>
</template>
