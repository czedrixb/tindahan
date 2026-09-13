<script setup lang="ts">
import { PhWarning, PhWarningOctagon } from '@phosphor-icons/vue'
import type { ConfirmRequest } from '~/composables/useConfirm'

const { request, resolve } = useConfirm()
const dialogRef = ref<HTMLDialogElement | null>(null)
const cancelRef = ref<HTMLButtonElement | null>(null)

// The composable clears `request` the instant resolve() is called, so we
// hold the last non-null request here to keep rendering title/body while
// the leave transition plays.
const current = ref<(ConfirmRequest & { id: number; confirmLabel: string; cancelLabel: string; tone: 'danger' | 'warn' }) | null>(null)
watch(
  () => request.value,
  (value) => {
    if (value) current.value = value
  },
)
const visible = computed(() => request.value !== null)

watch(visible, async (isVisible) => {
  if (!isVisible) return
  await nextTick()
  if (!dialogRef.value?.open) dialogRef.value?.showModal()
  await nextTick()
  // Safety default: focus lands on Cancel, never on the destructive action.
  cancelRef.value?.focus()
})

// v-if destroys the <dialog> element the instant `visible` goes false, but
// that only unmounts it - it never calls the native close() first. Chromium
// then leaves the modal's top-layer/backdrop entry behind, which silently
// eats pointer events on whatever dialog opens next. Always close() the
// element ourselves before resolving so nothing gets orphaned in the top
// layer.
function closeAndResolve(accepted: boolean) {
  dialogRef.value?.close()
  resolve(accepted)
}

function onCancel(event: Event) {
  // Fires for Esc-to-close on <dialog>. Treat it the same as tapping Cancel.
  event.preventDefault()
  closeAndResolve(false)
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialogRef.value) closeAndResolve(false)
}

const TONE_ICON = { danger: PhWarningOctagon, warn: PhWarning }
const TONE_ICON_CLASS = { danger: 'text-danger-600 bg-danger-50', warn: 'text-warn-600 bg-warn-50' }
</script>

<template>
  <ClientOnly>
    <dialog
      v-if="visible && current"
      ref="dialogRef"
      data-testid="confirm-dialog"
      class="m-0 max-h-none h-full w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-neutral-900/50"
      style="position: fixed; inset: 0"
      @cancel="onCancel"
      @click="onBackdropClick"
    >
      <div
        class="dialog-sheet-enter safe-bottom absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-[var(--radius-card)] border-t border-line bg-surface px-5 pt-5 [--safe-pb:1.25rem] lg:inset-x-0 lg:top-1/2 lg:bottom-auto lg:max-w-sm lg:-translate-y-1/2 lg:rounded-[var(--radius-card)] lg:border lg:pb-5"
        style="box-shadow: var(--shadow-sheet)"
        role="alertdialog"
        :aria-labelledby="`confirm-title-${current.id}`"
        @click.stop
      >
        <div class="flex items-start gap-3">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" :class="TONE_ICON_CLASS[current.tone]">
            <component :is="TONE_ICON[current.tone]" class="h-5 w-5" weight="fill" aria-hidden="true" />
          </span>
          <div class="flex-1 pt-1.5">
            <h2 :id="`confirm-title-${current.id}`" class="text-base font-bold text-ink">{{ current.title }}</h2>
            <p class="mt-1 text-sm leading-relaxed text-ink-muted">{{ current.body }}</p>
          </div>
        </div>

        <div class="mt-5 flex flex-col gap-2">
          <button
            ref="cancelRef"
            type="button"
            data-testid="confirm-cancel"
            class="press focus-ring min-h-[48px] w-full rounded-[var(--radius-control)] bg-brand-600 text-base font-semibold text-white active:bg-brand-700"
            @click="closeAndResolve(false)"
          >
            {{ current.cancelLabel }}
          </button>
          <button
            type="button"
            data-testid="confirm-accept"
            class="press focus-ring min-h-[48px] w-full rounded-[var(--radius-control)] border text-base font-semibold active:bg-danger-50"
            :class="current.tone === 'danger' ? 'border-danger-600 text-danger-600' : 'border-warn-600 text-warn-600'"
            @click="closeAndResolve(true)"
          >
            {{ current.confirmLabel }}
          </button>
        </div>
      </div>
    </dialog>
  </ClientOnly>
</template>
