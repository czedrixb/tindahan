<script setup lang="ts">
const { session, load } = useSession()
const forced = computed(() => Boolean(session.value?.user?.mustChangePassword))
const toast = useToast()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

const lengthError = computed(() => passwordLengthError(newPassword.value))
const mismatchError = computed(() => (newPassword.value ? passwordMismatchError(newPassword.value, confirmPassword.value) : null))
const canSubmit = computed(
  () =>
    currentPassword.value.length > 0 &&
    newPassword.value.length >= PASSWORD_MIN_LENGTH &&
    !lengthError.value &&
    newPassword.value === confirmPassword.value,
)

async function submit() {
  if (!canSubmit.value) return
  loading.value = true
  error.value = ''
  // Read before load({ force: true }) below overwrites session.value with
  // the post-change state (mustChangePassword now false) - otherwise this
  // always evaluated to false and sent every successful change to /settings
  // instead of sending a just-onboarded user home.
  const wasForced = forced.value
  try {
    await $fetch('/api/account/password', {
      method: 'POST',
      body: { currentPassword: currentPassword.value, newPassword: newPassword.value, confirmPassword: confirmPassword.value },
    })
    await load({ force: true })
    toast.success('Password changed.')
    await navigateTo(wasForced ? '/' : '/settings')
  } catch (err: unknown) {
    const message = apiErrorMessage(err, 'Could not change password')
    error.value = message
    toast.error(message)
    currentPassword.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="forced" class="flex min-h-screen flex-col justify-start bg-canvas px-6 pt-16 lg:justify-center lg:pt-0">
    <div class="mx-auto w-full max-w-[380px]">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-ink">Set your password</h1>
        <p class="mt-1 text-sm text-ink-subtle">Choose your own password before using the store app.</p>
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <AppField label="Current (temporary) password" for="current-password">
          <PasswordField id="current-password" v-model="currentPassword" testid="current-password" autocomplete="current-password" />
        </AppField>
        <AppField label="New password" for="new-password" :error="lengthError ?? undefined">
          <PasswordField id="new-password" v-model="newPassword" testid="new-password" autocomplete="new-password" />
        </AppField>
        <AppField label="Confirm new password" for="confirm-password" :error="mismatchError ?? undefined">
          <PasswordField id="confirm-password" v-model="confirmPassword" testid="confirm-password" autocomplete="new-password" />
        </AppField>

        <p v-if="error" data-testid="password-error" class="rounded-lg bg-danger-50 px-3 py-2 text-sm font-medium text-danger-600">{{ error }}</p>

        <AppButton type="submit" block size="lg" data-testid="submit-password" :loading="loading" :disabled="!canSubmit">
          {{ loading ? 'Saving' : 'Set Password' }}
        </AppButton>
      </form>
    </div>
  </div>

  <div v-else>
    <PageHeader title="Change Password" />
    <div class="page-shell page-shell--form">
      <form class="space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4" @submit.prevent="submit">
        <AppField label="Current password" for="current-password">
          <PasswordField id="current-password" v-model="currentPassword" testid="current-password" autocomplete="current-password" />
        </AppField>
        <AppField label="New password" for="new-password" :error="lengthError ?? undefined">
          <PasswordField id="new-password" v-model="newPassword" testid="new-password" autocomplete="new-password" />
        </AppField>
        <AppField label="Confirm new password" for="confirm-password" :error="mismatchError ?? undefined">
          <PasswordField id="confirm-password" v-model="confirmPassword" testid="confirm-password" autocomplete="new-password" />
        </AppField>

        <p v-if="error" data-testid="password-error" class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">{{ error }}</p>

        <AppButton type="submit" block size="sm" data-testid="submit-password" :loading="loading" :disabled="!canSubmit">
          {{ loading ? 'Saving' : 'Change Password' }}
        </AppButton>
        <NuxtLink to="/settings" class="focus-ring block text-center text-sm font-medium text-ink-subtle">Cancel</NuxtLink>
      </form>
    </div>
  </div>
</template>
