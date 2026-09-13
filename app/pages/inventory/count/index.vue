<script setup lang="ts">
import { PhClipboardText } from '@phosphor-icons/vue'
import type { InventoryCount } from '~/types'

const toast = useToast()

const counts = ref<InventoryCount[]>([])
const starting = ref(false)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    counts.value = await $fetch<InventoryCount[]>('/api/counts')
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err, 'Could not load inventory counts'))
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function startCount() {
  starting.value = true
  try {
    const created = await $fetch<InventoryCount>('/api/counts', { method: 'POST' })
    await navigateTo(`/inventory/count/${created.id}`)
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err, 'Could not start a new count'))
    starting.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Inventory Count" />

    <div class="page-shell page-shell--form space-y-4">
      <AppButton block :loading="starting" @click="startCount">
        {{ starting ? 'Starting' : '+ Start New Count' }}
      </AppButton>

      <AppSkeleton v-if="loading" variant="list" />
      <ul v-else-if="counts.length" class="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        <li v-for="(c, i) in counts" :key="c.id" class="list-enter-item" :style="{ '--i': i }">
          <NuxtLink :to="`/inventory/count/${c.id}`" class="focus-ring flex items-center justify-between px-4 py-3 active:bg-neutral-50">
            <div>
              <p class="font-medium text-ink">{{ formatDateLabel(c.countDate) }}</p>
              <p class="text-xs text-ink-subtle">{{ c.status === 'COMPLETED' ? 'Completed' : 'In progress' }}</p>
            </div>
            <AppBadge :tone="c.status === 'COMPLETED' ? 'neutral' : 'brand'">
              {{ c.status === 'COMPLETED' ? 'Done' : 'Open' }}
            </AppBadge>
          </NuxtLink>
        </li>
      </ul>
      <AppEmpty v-else :icon="PhClipboardText" message="No inventory counts yet." />
    </div>
  </div>
</template>
