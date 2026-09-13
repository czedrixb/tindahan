<script setup lang="ts">
import type { SessionResponse } from '~/types'

useHead({ title: 'Sign In' })

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const { set } = useSession()
const route = useRoute()

// Preserve the page the user was headed to before auth.global.ts bounced them
// here, so signing in lands them back where they intended instead of always
// falling through to the role default.
const redirectTarget = computed(() => {
  const target = route.query.redirect
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : null
})

async function submit() {
  if (!username.value.trim() || !password.value) return
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<SessionResponse>('/api/auth/login', {
      method: 'POST',
      body: { username: username.value.trim(), password: password.value },
    })
    set(res)
    await navigateTo(redirectTarget.value ?? (res.user?.role === 'MEMBER' ? '/sales/new' : '/'))
  } catch (err: unknown) {
    error.value = apiErrorMessage(err, 'Incorrect username or password')
    password.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col justify-start bg-canvas px-6 pt-16 lg:justify-center lg:pt-0">
    <div class="mx-auto w-full max-w-[380px]">
      <div class="mb-10 flex items-center gap-3">
        <BrandMark :size="40" />
        <span class="text-lg font-bold tracking-tight text-ink">Tindahan</span>
      </div>

      <form class="space-y-5" @submit.prevent="submit">
        <div>
          <h1 class="text-2xl font-bold text-ink">Sign in</h1>
          <p class="mt-1 text-sm text-ink-subtle">Your store, ready for the day.</p>
        </div>

        <AppField label="Username" for="username">
          <input
            id="username"
            v-model="username"
            name="username"
            type="text"
            autocomplete="username"
            autofocus
            class="field-input"
          />
        </AppField>
        <AppField label="Password" for="password">
          <PasswordField id="password" v-model="password" testid="login-password" autocomplete="current-password" />
        </AppField>

        <p v-if="error" class="rounded-lg bg-danger-50 px-3 py-2 text-sm font-medium text-danger-600">{{ error }}</p>

        <AppButton type="submit" block size="lg" :loading="loading" :disabled="!username.trim() || !password">
          {{ loading ? 'Signing in' : 'Sign in' }}
        </AppButton>

        <p class="text-center text-sm text-ink-subtle">Need access? Ask your store admin.</p>
      </form>
    </div>
  </div>
</template>
