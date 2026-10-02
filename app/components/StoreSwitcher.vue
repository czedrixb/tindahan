<script setup lang="ts">
import { PhMapPin } from '@phosphor-icons/vue'

defineProps<{ compact?: boolean }>()
const { session, set } = useSession()
const { switchStore } = useCart()
const toast = useToast()
const switching = ref(false)
const selected = computed({
  get: () => session.value?.activeStore?.id ?? 0,
  set: async (storeId: number) => {
    if (!storeId || storeId === session.value?.activeStore?.id) return
    switching.value = true
    try {
      const next = await $fetch('/api/stores/active', { method: 'POST', body: { storeId } })
      switchStore(storeId)
      set(next)
      await refreshNuxtData()
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, 'Could not switch stores'))
    } finally {
      switching.value = false
    }
  },
})
</script>

<template>
  <label
    v-if="session?.activeStore"
    class="flex min-w-0 items-center gap-2 text-ink-muted"
    :class="compact ? 'text-xs' : 'text-sm'"
  >
    <PhMapPin class="h-4 w-4 shrink-0 text-brand-600" weight="fill" aria-hidden="true" />
    <span class="sr-only">Active store</span>
    <select
      v-if="session.stores.length > 1"
      v-model.number="selected"
      data-testid="store-switcher"
      class="focus-ring min-w-0 rounded-[var(--radius-control)] border border-line bg-surface px-2 py-1 font-semibold text-ink disabled:opacity-60"
      :disabled="switching"
    >
      <option v-for="store in session.stores" :key="store.id" :value="store.id">{{ store.name }}</option>
    </select>
    <span v-else data-testid="active-store" class="truncate font-semibold text-ink">{{ session.activeStore.name }}</span>
  </label>
</template>
