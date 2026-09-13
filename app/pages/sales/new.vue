<script setup lang="ts">
import { PhMagnifyingGlass, PhMinus, PhPlus, PhX } from '@phosphor-icons/vue'
import type { Product, SaleReceipt } from '~/types'
import type { CartLine } from '~/composables/useCart'

const toast = useToast()
const { confirm } = useConfirm()
// Shared across pages (useState-backed) so leaving /sales/new - a bottom-nav
// tap, a forced auth redirect, a PWA reload - no longer discards the sale.
const { lines: cart, cash: cashInput, submissionKey, clear: clearCartState } = useCart()

const search = ref('')
const results = ref<Product[]>([])
// Browse list shown while the search box is idle, so the left column always
// has something to sell from rather than a bare hint (docs/2026-09-13-pos-redesign.md
// "New sale" spec). Kept in a separate testid/array from `results` so tests
// asserting on actual search matches (data-testid="search-result") are
// unaffected by what this list contains.
const frequentProducts = ref<Product[]>([])
const saving = ref(false)
const voiding = ref(false)
const errorMessage = ref('')
const completedSale = ref<SaleReceipt | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | undefined
// Bumped every time a load is *requested*, so a slower, older response can't
// land after a newer query has already rendered and silently replace the
// correct results with the wrong ones.
let loadGen = 0

async function loadProducts() {
  const query = search.value.trim()
  if (!query) return
  const gen = loadGen
  const data = await $fetch<Product[]>('/api/products', { query: { q: query, active: 'true' } })
  if (gen === loadGen) results.value = data
}

function requestLoad() {
  loadGen++
  clearTimeout(searchTimer)
  if (!search.value.trim()) {
    // Nothing typed: show nothing rather than the whole catalog, so adding a
    // product (which clears the search box) leaves the cart in place instead
    // of burying it under a freshly reloaded product list.
    results.value = []
    return
  }
  searchTimer = setTimeout(loadProducts, 200)
}

watch(search, () => {
  // Clear stale matches the instant typing starts so a fast click can't land
  // on a result left over from before the keystroke while the debounced
  // search is still in flight.
  results.value = []
  requestLoad()
})

onMounted(async () => {
  try {
    frequentProducts.value = await $fetch<Product[]>('/api/products/frequent', { query: { limit: 12 } })
  } catch {
    // Non-essential: the idle state just falls back to the plain hint below.
    frequentProducts.value = []
  }
})

function addToCart(product: Product) {
  if (product.costPrice === null || product.sellingPrice === null) {
    errorMessage.value = 'This product needs pricing before it can be sold.'
    return
  }
  if (product.stock <= 0) {
    errorMessage.value = 'Out of stock.'
    return
  }
  errorMessage.value = ''

  const existing = cart.value.find((line) => line.product.id === product.id)
  if (existing) {
    if (existing.quantity < product.stock) existing.quantity++
  } else {
    if (cart.value.length === 0) submissionKey.value = crypto.randomUUID()
    cart.value.push({ product, quantity: 1 })
  }

  search.value = ''
  results.value = []
}

function clampLineQuantity(line: CartLine) {
  if (typeof line.quantity !== 'number' || Number.isNaN(line.quantity) || line.quantity < 1) {
    line.quantity = 1
  } else if (line.quantity > line.product.stock) {
    line.quantity = line.product.stock
  }
}
watch(cart, () => { for (const line of cart.value) clampLineQuantity(line) }, { deep: true })

function incLine(line: CartLine) {
  if (line.quantity < line.product.stock) line.quantity++
}
function decLine(line: CartLine) {
  if (line.quantity > 1) line.quantity--
}
function removeLine(index: number) {
  cart.value.splice(index, 1)
}

function clearCart() {
  clearCartState()
  errorMessage.value = ''
}

const total = computed(() => cart.value.reduce((sum, line) => sum + (line.product.sellingPrice ?? 0) * line.quantity, 0))

// Accepts whole pesos or up to two decimal places; anything else (blank,
// letters, three-plus decimals, negative) is not a valid amount.
const CASH_PATTERN = /^\d+(\.\d{1,2})?$/
const cashValid = computed(() => CASH_PATTERN.test(cashInput.value.trim()))
const cashCentavos = computed(() => (cashValid.value ? pesosToCentavos(parseFloat(cashInput.value.trim())) : null))
const changeDue = computed(() => (cashCentavos.value === null ? null : cashCentavos.value - total.value))
const hasShortfall = computed(() => changeDue.value !== null && changeDue.value < 0)

const canComplete = computed(
  () =>
    cart.value.length > 0 &&
    cart.value.every(
      (line) =>
        line.product.costPrice !== null &&
        line.product.sellingPrice !== null &&
        line.quantity > 0 &&
        line.quantity <= line.product.stock,
    ) &&
    cashValid.value &&
    changeDue.value !== null &&
    changeDue.value >= 0 &&
    !saving.value,
)

async function saveSale() {
  if (!canComplete.value || saving.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    const receipt = await $fetch<SaleReceipt>('/api/sales', {
      method: 'POST',
      body: {
        items: cart.value.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        cashReceived: cashCentavos.value,
        submissionKey: submissionKey.value,
      },
    })
    completedSale.value = receipt
    // The sale is recorded now - clear the shared cart so a later visit to
    // this page doesn't resurrect an already-sold cart.
    clearCartState()
  } catch (err: unknown) {
    const message = apiErrorMessage(err, 'Could not save sale')
    errorMessage.value = message
    toast.error(message)
  } finally {
    saving.value = false
  }
}

async function voidCompletedSale() {
  if (!completedSale.value || completedSale.value.voidedAt || voiding.value) return

  const qty = completedSale.value.lines.reduce((sum, line) => sum + line.quantity, 0)
  const ok = await confirm({
    title: 'Void this sale?',
    body: `The ${qty} item${qty === 1 ? '' : 's'} go back into stock and ${formatPeso(completedSale.value.revenue)} stops counting toward revenue.`,
    confirmLabel: 'Void sale',
    tone: 'danger',
  })
  if (!ok) return

  voiding.value = true
  errorMessage.value = ''
  try {
    const voided = await $fetch<SaleReceipt>(`/api/sales/${completedSale.value.id}`, { method: 'DELETE' })
    completedSale.value = { ...completedSale.value, voidedAt: voided.voidedAt }
    toast.success('Sale voided. Stock restored.')
  } catch (err: unknown) {
    const message = apiErrorMessage(err, 'Could not void sale')
    errorMessage.value = message
    toast.error(message)
  } finally {
    voiding.value = false
  }
}

async function startNewSale() {
  completedSale.value = null
  clearCart()
  await nextTick()
  searchInput.value?.focus()
}

// The cart is shared state now (useCart), so leaving no longer loses it -
// but the cashier may still not want to wander off mid-sale, so ask. A
// completed sale is already saved and never blocks navigation.
//
// Vue Router can invoke this guard a second time for the same departure -
// once the cart stopped being cleared on leave (previously `cart.value = []`
// made the second call take the `cart.value.length === 0` fast path above
// and resolve silently), a duplicate call instead re-opened the confirm
// dialog after the cashier had already answered it, silently eating the tap
// on whatever they tried to do next. Cache the answer per mount: once they
// say "Leave", any further call for this instance leaves without asking
// again; choosing "Stay" clears the cache so a later, real departure still
// prompts.
let leaveDecision: boolean | null = null
onBeforeRouteLeave(async (to) => {
  if (completedSale.value || cart.value.length === 0) return true
  // Forced redirects (expired session, mandatory password change) aren't a
  // navigation the cashier chose - don't ask them to confirm one they can't
  // decline.
  if (to.path === '/login' || to.path === '/settings/password') return true
  if (leaveDecision !== null) return leaveDecision
  const accepted = await confirm({
    title: 'Leave this unfinished sale?',
    body: 'This sale is not recorded yet. The cart will still be here when you come back.',
    confirmLabel: 'Leave',
    cancelLabel: 'Stay',
    tone: 'warn',
  })
  leaveDecision = accepted || null
  return accepted
})
</script>

<template>
  <div>
    <PageHeader title="New sale" />

    <div class="page-shell space-y-4">
      <div
        v-if="errorMessage"
        class="rounded-[var(--radius-control)] bg-danger-50 px-4 py-3 text-center text-sm font-semibold text-danger-600"
        data-testid="sale-error"
      >
        {{ errorMessage }}
      </div>

      <template v-if="completedSale">
        <AppCard data-testid="sale-summary" class="mx-auto lg:max-w-xl">
          <p
            class="mb-3 rounded-lg px-3 py-2 text-center text-sm font-semibold"
            :class="completedSale.voidedAt ? 'bg-neutral-100 text-ink-subtle' : 'bg-success-50 text-success-700'"
          >
            {{ completedSale.voidedAt ? 'Voided. Stock restored.' : 'Sale complete' }}
          </p>

          <ul class="divide-y divide-line">
            <li v-for="line in completedSale.lines" :key="line.id" class="py-2" data-testid="summary-line">
              <p class="font-semibold text-ink">
                {{ line.productName
                }}<span v-if="line.productVariant" class="font-normal text-ink-subtle"> · {{ line.productVariant }}</span>
              </p>
              <p class="text-sm text-ink-subtle">
                {{ line.quantity }} × {{ formatPeso(line.sellingPrice) }} = {{ formatPeso(line.revenue) }}
              </p>
              <p class="text-xs text-ink-subtle" data-testid="summary-stock">
                Stock: {{ line.previousStock }} → {{ line.newStock }}
              </p>
            </li>
          </ul>

          <div class="mt-4 space-y-2 border-t border-line pt-3">
            <div class="flex items-center justify-between text-sm">
              <span class="text-ink-subtle">Total</span>
              <span class="font-semibold tabular-nums text-ink">{{ formatPeso(completedSale.revenue) }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-ink-subtle">Cash received</span>
              <span class="font-semibold tabular-nums text-ink">{{ formatPeso(completedSale.cashReceived ?? 0) }}</span>
            </div>
            <div class="flex items-center justify-between border-t border-line pt-2 text-sm">
              <span class="font-semibold text-ink">Change due</span>
              <span class="pop-in text-xl font-bold tabular-nums text-ink" data-testid="summary-change">
                {{ formatPeso(completedSale.changeDue ?? 0) }}
              </span>
            </div>
          </div>

          <AppButton
            v-if="!completedSale.voidedAt"
            variant="danger"
            block
            class="mt-5"
            :loading="voiding"
            data-testid="void-sale"
            @click="voidCompletedSale"
          >
            {{ voiding ? 'Voiding' : 'Void this sale' }}
          </AppButton>

          <AppButton block class="mt-3" data-testid="new-sale" @click="startNewSale">
            New sale
          </AppButton>
        </AppCard>
      </template>

      <template v-else>
        <div class="lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-8">
          <div class="space-y-4">
            <div class="sticky-search -mx-4 border-b border-line bg-surface-sunken px-4 pt-3 pb-3 lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:pb-0">
              <div class="relative">
                <PhMagnifyingGlass class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
                <input
                  ref="searchInput"
                  v-model="search"
                  type="search"
                  placeholder="Search product..."
                  class="field-input field-input--with-leading-icon"
                  data-testid="product-search"
                />
              </div>
            </div>

            <ul v-if="results.length" class="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              <li v-for="(p, i) in results" :key="p.id" class="list-enter-item" :style="{ '--i': i }">
                <button
                  type="button"
                  class="relative z-10 flex w-full touch-manipulation items-center justify-between px-4 py-3 text-left active:bg-neutral-50"
                  data-testid="search-result"
                  @click="addToCart(p)"
                  @touchend.prevent="addToCart(p)"
                >
                  <span>
                    <span class="font-medium text-ink">{{ p.name }}</span>
                    <span v-if="p.variant" class="text-ink-subtle"> · {{ p.variant }}</span>
                  </span>
                  <span class="flex items-center gap-3 text-xs text-ink-subtle">
                    {{ formatPeso(p.sellingPrice ?? 0) }} · {{ p.stock }} in stock
                    <PhPlus class="h-4 w-4 text-brand-600" weight="bold" aria-hidden="true" />
                  </span>
                </button>
              </li>
            </ul>
            <p v-else-if="search.trim()" class="py-6 text-center text-sm text-ink-subtle">No matching products.</p>

            <!-- Once a sale is in progress, don't stack a long browse list
                 above the Current sale panel on mobile - it pushed the total
                 and Complete sale action off-screen (see the viewport check
                 in tests/e2e/16-checkout-cart-and-headers.spec.ts). Idle
                 browsing is only offered before the first item is added. -->
            <p v-else-if="cart.length" class="py-6 text-center text-sm text-ink-subtle">Search for another product to add it.</p>

            <template v-else>
              <template v-if="frequentProducts.length">
                <h2 class="text-sm font-semibold text-ink-muted">Frequently sold</h2>
                <ul class="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                  <li v-for="(p, i) in frequentProducts" :key="p.id" class="list-enter-item" :style="{ '--i': i }">
                    <button
                      type="button"
                      class="relative z-10 flex w-full touch-manipulation items-center justify-between px-4 py-3 text-left active:bg-neutral-50"
                      data-testid="frequent-product"
                      @click="addToCart(p)"
                      @touchend.prevent="addToCart(p)"
                    >
                      <span>
                        <span class="font-medium text-ink">{{ p.name }}</span>
                        <span v-if="p.variant" class="text-ink-subtle"> · {{ p.variant }}</span>
                      </span>
                      <span class="flex items-center gap-3 text-xs text-ink-subtle">
                        {{ formatPeso(p.sellingPrice ?? 0) }} · {{ p.stock }} in stock
                        <PhPlus class="h-4 w-4 text-brand-600" weight="bold" aria-hidden="true" />
                      </span>
                    </button>
                  </li>
                </ul>
              </template>
              <p v-else class="py-6 text-center text-sm text-ink-subtle">Search for a product to add it to the cart.</p>
            </template>
          </div>

          <div v-if="cart.length" class="mt-4 lg:mt-0 lg:sticky lg:top-24">
            <AppCard>
              <div class="flex items-center justify-between">
                <h2 class="text-sm font-semibold text-ink-muted">Current sale</h2>
                <button type="button" class="focus-ring rounded text-xs font-semibold text-brand-600" @click="clearCart">Clear</button>
              </div>

              <div
                v-for="(line, i) in cart"
                :key="line.product.id"
                class="list-enter-item mt-3 border-b border-line pb-3 last:border-0 last:pb-0"
                :style="{ '--i': i }"
                data-testid="cart-line"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <p class="font-semibold text-ink">
                      {{ line.product.name
                      }}<span v-if="line.product.variant" class="font-normal text-ink-subtle"> · {{ line.product.variant }}</span>
                    </p>
                    <p class="text-xs text-ink-subtle">{{ formatPeso(line.product.sellingPrice ?? 0) }} each · {{ line.product.stock }} in stock</p>
                  </div>
                  <button
                    type="button"
                    class="focus-ring flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-danger-600 active:bg-danger-50"
                    data-testid="cart-line-remove"
                    @click="removeLine(i)"
                  >
                    <PhX class="h-3.5 w-3.5" weight="bold" />
                    Remove
                  </button>
                </div>

                <div class="mt-2 flex items-center gap-4">
                  <button
                    type="button"
                    class="press focus-ring flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-ink-muted active:bg-neutral-200"
                    data-testid="qty-decrement"
                    @click="decLine(line)"
                  >
                    <PhMinus class="h-4 w-4" weight="bold" />
                  </button>
                  <input
                    v-model.number="line.quantity"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    :max="line.product.stock"
                    class="field-input w-14 px-1 py-1.5 text-center text-xl font-bold tabular-nums"
                    data-testid="qty-input"
                    @blur="clampLineQuantity(line)"
                  />
                  <button
                    type="button"
                    class="press focus-ring flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-ink-muted active:bg-neutral-200"
                    data-testid="qty-increment"
                    @click="incLine(line)"
                  >
                    <PhPlus class="h-4 w-4" weight="bold" />
                  </button>
                  <span class="ml-auto font-semibold tabular-nums text-ink">
                    {{ formatPeso((line.product.sellingPrice ?? 0) * line.quantity) }}
                  </span>
                </div>
              </div>

              <div class="mt-3 flex items-center justify-between border-t border-line pt-3">
                <span class="text-sm text-ink-subtle">Total</span>
                <span class="text-xl font-bold tabular-nums text-ink" data-testid="sale-total">{{ formatPeso(total) }}</span>
              </div>

              <AppField label="Cash received" for="cash-received" class="mt-4">
                <input
                  id="cash-received"
                  v-model="cashInput"
                  type="text"
                  inputmode="decimal"
                  placeholder="0.00"
                  class="field-input text-lg tabular-nums"
                  data-testid="cash-received"
                />
              </AppField>

              <div v-if="cashInput.trim()" class="mt-3 flex items-center justify-between border-t border-line pt-3">
                <template v-if="!cashValid">
                  <p class="text-sm font-medium text-danger-600">Enter a valid amount.</p>
                </template>
                <template v-else-if="hasShortfall">
                  <span class="text-sm text-danger-600">Still needed</span>
                  <span class="text-xl font-bold tabular-nums text-danger-600" data-testid="cash-shortfall">
                    {{ formatPeso(Math.abs(changeDue ?? 0)) }}
                  </span>
                </template>
                <template v-else>
                  <span class="text-sm text-ink-subtle">Change</span>
                  <span class="text-xl font-bold tabular-nums text-ink" data-testid="change-due">
                    {{ formatPeso(changeDue ?? 0) }}
                  </span>
                </template>
              </div>

              <AppButton block class="mt-5" :loading="saving" :disabled="!canComplete" data-testid="save-sale" @click="saveSale">
                {{ saving ? 'Saving' : 'Complete sale' }}
              </AppButton>
            </AppCard>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
