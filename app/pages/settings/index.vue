<script setup lang="ts">
import { PhCaretRight, PhFileArrowUp, PhSignOut } from '@phosphor-icons/vue'
import type { ImportPreview } from '~/types'

const { session, clear } = useSession()
const isAdmin = computed(() => session.value?.user?.role === 'ADMIN')
const toast = useToast()
const { confirm } = useConfirm()

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const preview = ref<ImportPreview | null>(null)
const committing = ref(false)
// Stock is part of an inventory import. Keeping this on by default prevents
// quantity-bearing spreadsheets from accidentally creating zero-stock products.
const importStock = ref(true)
const result = ref<{ created: number; updated: number; skipped: number } | null>(null)
const error = ref('')

async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  error.value = ''
  result.value = null
  try {
    const formData = new FormData()
    formData.append('file', file)
    preview.value = await $fetch<ImportPreview>('/api/import/excel', { method: 'POST', body: formData })
  } catch (err: unknown) {
    const message = apiErrorMessage(err, 'Could not read file')
    error.value = message
    toast.error(message)
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function commitImport() {
  if (!preview.value) return

  const ok = await confirm({
    title: 'Import this spreadsheet?',
    body: importStock.value
      ? `This creates ${preview.value.toCreate} products and sets their stock to the quantities in the spreadsheet. It also rewrites stock on ${preview.value.toUpdate} existing ones.`
      : `This creates ${preview.value.toCreate} products without changing stock. New products will start at 0 until stock is updated.`,
    confirmLabel: 'Import',
    tone: 'warn',
  })
  if (!ok) return

  committing.value = true
  error.value = ''
  try {
    result.value = await $fetch('/api/import/commit', { method: 'POST', body: { rows: preview.value.rows, importStock: importStock.value } })
    preview.value = null
    toast.success('Inventory imported.')
  } catch (err: unknown) {
    const message = apiErrorMessage(err, 'Import failed')
    error.value = message
    toast.error(message)
  } finally {
    committing.value = false
  }
}

async function logout() {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err, 'Could not log out'))
    return
  }
  clear()
  await navigateTo('/login')
}
</script>

<template>
  <div>
    <PageHeader title="More" />

    <div class="page-shell page-shell--form space-y-6">
      <section class="space-y-2">
        <h2 class="text-sm font-semibold text-ink-muted">Account</h2>
        <AppCard>
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium text-ink">{{ session?.user?.displayName }}</p>
            <AppBadge data-testid="my-role" :tone="isAdmin ? 'brand' : 'neutral'">
              {{ isAdmin ? 'Admin' : 'Member' }}
            </AppBadge>
          </div>
          <p class="text-xs text-ink-subtle">@{{ session?.user?.username }}</p>
        </AppCard>
        <NuxtLink to="/settings/password" data-testid="change-password-link" class="focus-ring flex items-center justify-between rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 text-sm font-medium text-ink active:bg-neutral-50">
          <span>Change Password</span><PhCaretRight class="h-4 w-4 text-ink-subtle" aria-hidden="true" />
        </NuxtLink>
        <NuxtLink v-if="isAdmin" to="/settings/users" data-testid="manage-users-link" class="focus-ring flex items-center justify-between rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 text-sm font-medium text-ink active:bg-neutral-50">
          <span>Manage Users</span><PhCaretRight class="h-4 w-4 text-ink-subtle" aria-hidden="true" />
        </NuxtLink>
        <NuxtLink v-if="isAdmin" to="/settings/audit" class="focus-ring flex items-center justify-between rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 text-sm font-medium text-ink active:bg-neutral-50">
          <span>View Audit Log</span><PhCaretRight class="h-4 w-4 text-ink-subtle" aria-hidden="true" />
        </NuxtLink>
      </section>

      <section class="space-y-2">
        <h2 class="text-sm font-semibold text-ink-muted">Products</h2>
        <NuxtLink to="/products/new" class="focus-ring block rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 text-sm font-medium text-ink active:bg-neutral-50">
          Add Product
        </NuxtLink>
        <NuxtLink to="/products/pricing" class="focus-ring block rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 text-sm font-medium text-ink active:bg-neutral-50">
          Needs Pricing Queue
        </NuxtLink>
      </section>

      <section class="space-y-2">
        <h2 class="text-sm font-semibold text-ink-muted">Excel</h2>

        <a href="/api/export/inventory" class="focus-ring block rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 text-sm font-medium text-ink active:bg-neutral-50">
          Export Current Inventory
        </a>

        <AppCard>
          <p class="flex items-center gap-1.5 text-sm font-medium text-ink">
            <PhFileArrowUp class="h-4 w-4 text-ink-subtle" aria-hidden="true" />
            Import Inventory Spreadsheet
          </p>
          <p class="mt-1 text-xs text-ink-subtle">
            Upload the store's Excel inventory. New products are created; existing products (matched by name + variant) have their stock reconciled.
          </p>
          <input
            ref="fileInput"
            type="file"
            accept=".xlsx"
            class="focus-ring mt-3 block w-full text-sm"
            data-testid="import-file-input"
            @change="onFileChange"
          />

          <p v-if="uploading" class="mt-2 text-sm text-ink-subtle">Reading file</p>
          <p v-if="error" class="mt-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">{{ error }}</p>

          <div v-if="preview" class="mt-3 space-y-2 rounded-lg bg-surface-sunken p-3 text-sm" data-testid="import-preview">
            <p>{{ preview.totalRows }} rows found. {{ preview.toCreate }} new, {{ preview.toUpdate }} to update.</p>
            <p v-if="!preview.hasPrices" class="text-warn-600">No prices found in this file. Imported products will need pricing.</p>
            <label class="flex items-start gap-2 text-xs text-ink-muted">
              <input v-model="importStock" type="checkbox" class="mt-0.5" data-testid="import-stock-toggle" />
              <span>Import spreadsheet stock quantities. Leave this on to set each product to the quantity in the spreadsheet; turn it off to import products and prices only.</span>
            </label>
            <AppButton block size="sm" :loading="committing" data-testid="confirm-import" @click="commitImport">
              {{ committing ? 'Importing' : 'Confirm Import' }}
            </AppButton>
          </div>

          <p v-if="result" class="mt-2 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700" data-testid="import-result">
            Created {{ result.created }}, updated {{ result.updated }}, skipped {{ result.skipped }}.
          </p>
        </AppCard>
      </section>

      <section>
        <AppButton variant="danger" block @click="logout">
          <PhSignOut class="h-4 w-4" weight="bold" aria-hidden="true" />
          Log Out
        </AppButton>
      </section>
    </div>
  </div>
</template>
