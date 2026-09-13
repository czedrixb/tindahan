<script setup lang="ts">
import { PhCheckCircle, PhWarningCircle, PhInfo, PhX } from '@phosphor-icons/vue'
import type { ToastTone } from '~/composables/useToast'

const { toasts, dismiss } = useToast()

const ICON: Record<ToastTone, typeof PhCheckCircle> = {
  success: PhCheckCircle,
  error: PhWarningCircle,
  info: PhInfo,
}

// Toasts sit on a deep-ink surface (not a pale brand-tinted panel) so the
// tone comes through in the icon and left rule only. Success stays on the
// green success-* family (not brand) so it keeps reading as "good" now that
// brand is periwinkle rather than green.
const TONE_ACCENT: Record<ToastTone, string> = {
  success: 'border-l-success-500 [&_svg]:text-success-500',
  error: 'border-l-danger-500 [&_svg]:text-danger-400',
  info: 'border-l-info-500 [&_svg]:text-neutral-300',
}
</script>

<template>
  <div
    class="safe-bottom pointer-events-none fixed inset-x-0 bottom-28 z-50 mx-auto flex max-w-md flex-col gap-2 px-4 lg:bottom-6"
    aria-label="Notifications"
  >
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        data-testid="toast"
        :data-tone="toast.tone"
        :role="toast.tone === 'error' ? 'alert' : 'status'"
        :aria-live="toast.tone === 'error' ? 'assertive' : 'polite'"
        class="pointer-events-auto flex items-start gap-2.5 rounded-[var(--radius-control)] border-l-4 bg-neutral-900 py-3 pl-3 pr-2 text-neutral-50 shadow-[var(--shadow-raised)]"
        :class="TONE_ACCENT[toast.tone]"
      >
        <component :is="ICON[toast.tone]" class="mt-0.5 h-5 w-5 shrink-0" weight="fill" aria-hidden="true" />
        <p class="flex-1 text-sm font-medium leading-snug">{{ toast.message }}</p>
        <button
          type="button"
          class="focus-ring shrink-0 rounded-full p-1 text-neutral-400 active:bg-neutral-800"
          aria-label="Dismiss notification"
          @click="dismiss(toast.id)"
        >
          <PhX class="h-4 w-4" weight="bold" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
