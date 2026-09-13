<script setup lang="ts">
const route = useRoute()
const showNav = computed(() => route.path !== '/login' && route.path !== '/settings/password')

// The bottom nav is `position: fixed`, so its hit-test area stays pinned to
// the layout viewport even when an on-screen keyboard shrinks the visible
// one - e.g. tapping a search result near the bottom of the screen while
// typing on /sales/new can land on the "Sale" tab underneath it instead,
// firing a phantom navigateTo('/sales/new') and yanking focus away from the
// search flow. Hiding the nav for the duration of text-field focus removes
// the overlap instead of trying to out-guess keyboard geometry.
const textInputFocused = ref(false)
const NON_TEXT_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'])
function isTextField(el: Element | null): boolean {
  if (!el) return false
  if (el.tagName === 'TEXTAREA') return true
  return el.tagName === 'INPUT' && !NON_TEXT_INPUT_TYPES.has((el as HTMLInputElement).type)
}
function syncFocusState() {
  textInputFocused.value = isTextField(document.activeElement)
}
let restoreNavTimer: ReturnType<typeof setTimeout> | undefined
function onFocusOut() {
  // The new activeElement isn't set until after this event, so re-check
  // shortly after instead of assuming focus left every text field entirely.
  // A same-frame requestAnimationFrame check used to run this, but a tap that
  // blurs a text field by landing on a button *below* it (e.g. Complete sale
  // under a tall cart) can still be mid-gesture (mousedown already blurred
  // the field; mouseup/click hasn't dispatched yet) when that callback fires -
  // remounting the nav right then can put it back over the pointer before the
  // click lands, silently swallowing the tap. A short timeout outlasts that
  // gesture instead of racing it.
  clearTimeout(restoreNavTimer)
  restoreNavTimer = setTimeout(syncFocusState, 150)
}
onMounted(() => {
  document.addEventListener('focusin', syncFocusState)
  document.addEventListener('focusout', onFocusOut)
})
onBeforeUnmount(() => {
  clearTimeout(restoreNavTimer)
  document.removeEventListener('focusin', syncFocusState)
  document.removeEventListener('focusout', onFocusOut)
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-transparent" :class="showNav ? 'lg:grid lg:grid-cols-[15rem_1fr] lg:items-stretch' : ''">
    <AppSidebar v-if="showNav" class="hidden lg:flex" />
    <main class="relative z-0 mx-auto w-full max-w-md flex-1 lg:max-w-none" :class="showNav ? 'pb-28 lg:pb-0' : ''">
      <slot />
    </main>
    <BottomNav v-if="showNav && !textInputFocused" />
    <ToastHost />
    <ConfirmDialog />
  </div>
</template>
