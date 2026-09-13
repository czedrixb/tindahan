<script setup lang="ts">
import { PhCaretDown, PhCaretUp } from '@phosphor-icons/vue'
import type { StoreUser, UserRole } from '~/types'

definePageMeta({ middleware: 'admin' })

const { session } = useSession()
const { data: users, refresh } = await useFetch<StoreUser[]>('/api/users')

const { confirm } = useConfirm()

const message = ref('')
const error = ref('')
const busy = ref(false)

const showAddForm = ref(false)
const form = reactive({ displayName: '', username: '', password: '', role: 'MEMBER' as UserRole })

const openId = ref<number | null>(null)
const resetOpenId = ref<number | null>(null)
const resetPassword = ref('')
const resetConfirmPassword = ref('')
const editOpenId = ref<number | null>(null)
const editForm = reactive({ displayName: '', username: '' })

const resetLengthError = computed(() => passwordLengthError(resetPassword.value))
const resetMismatchError = computed(() =>
  resetPassword.value ? passwordMismatchError(resetPassword.value, resetConfirmPassword.value) : null,
)
const resetCanSubmit = computed(
  () =>
    resetPassword.value.length >= PASSWORD_MIN_LENGTH &&
    !resetLengthError.value &&
    resetPassword.value === resetConfirmPassword.value,
)

const myId = computed(() => session.value?.user?.id)
const activeAdminCount = computed(() => users.value?.filter((u) => u.role === 'ADMIN' && u.isActive).length ?? 0)
const sorted = computed(() => [...(users.value ?? [])].sort((a, b) => Number(b.isActive) - Number(a.isActive)))

function isLastActiveAdmin(u: StoreUser) {
  return u.role === 'ADMIN' && u.isActive && activeAdminCount.value <= 1
}

// The inline banner below already surfaces both outcomes here, so this
// intentionally doesn't also fire a toast with the same wording - see the
// note on products/[id].vue's saveDetails for why that would be redundant.
async function run(fn: () => Promise<unknown>, ok: string) {
  busy.value = true
  error.value = ''
  message.value = ''
  try {
    await fn()
    await refresh()
    message.value = ok
  } catch (err: unknown) {
    error.value = apiErrorMessage(err, 'Could not save')
  } finally {
    busy.value = false
  }
}

function createUser() {
  return run(async () => {
    await $fetch('/api/users', { method: 'POST', body: { ...form } })
    Object.assign(form, { displayName: '', username: '', password: '', role: 'MEMBER' })
    showAddForm.value = false
  }, 'Account created. Share the temporary password with them.')
}

function setRole(u: StoreUser, role: UserRole) {
  return run(() => $fetch(`/api/users/${u.id}`, { method: 'PATCH', body: { role } }), 'Role updated.')
}

async function demote(u: StoreUser) {
  const ok = await confirm({
    title: `Remove admin access from ${u.displayName}?`,
    body: `${u.displayName} loses access to Users, the audit log, and reports.`,
    confirmLabel: 'Remove admin access',
    tone: 'warn',
  })
  if (!ok) return
  await setRole(u, 'MEMBER')
}

async function setActive(u: StoreUser, isActive: boolean) {
  if (isActive) {
    openId.value = null
    await run(() => $fetch(`/api/users/${u.id}`, { method: 'PATCH', body: { isActive } }), 'Account reactivated.')
    return
  }

  const ok = await confirm({
    title: `Deactivate ${u.displayName}?`,
    body: `${u.displayName} can no longer sign in. Their past activity stays in the audit log.`,
    confirmLabel: 'Deactivate account',
    tone: 'danger',
  })
  if (!ok) return

  openId.value = null
  await run(() => $fetch(`/api/users/${u.id}`, { method: 'PATCH', body: { isActive } }), 'Account deactivated.')
}

function toggleReset(u: StoreUser) {
  resetOpenId.value = resetOpenId.value === u.id ? null : u.id
  // Never let a typed password linger past a close or a switch to another
  // user's row.
  resetPassword.value = ''
  resetConfirmPassword.value = ''
}

async function submitReset(u: StoreUser) {
  if (!resetCanSubmit.value) return

  const ok = await confirm({
    title: `Reset ${u.displayName}'s access?`,
    body: `${u.displayName} is signed out and must set a new password on their next sign-in.`,
    confirmLabel: 'Reset access',
    tone: 'warn',
  })
  if (!ok) return

  await run(async () => {
    await $fetch(`/api/users/${u.id}/reset-password`, {
      method: 'POST',
      body: { password: resetPassword.value, confirmPassword: resetConfirmPassword.value },
    })
    resetOpenId.value = null
  }, 'Access reset. Share the new temporary password with them.')
  // Cleared on both success and failure - a failed attempt should not leave
  // the temporary password sitting in the form.
  resetPassword.value = ''
  resetConfirmPassword.value = ''
}

function toggleEdit(u: StoreUser) {
  editOpenId.value = editOpenId.value === u.id ? null : u.id
  if (editOpenId.value === u.id) Object.assign(editForm, { displayName: u.displayName, username: u.username })
}

function submitEdit(u: StoreUser) {
  return run(async () => {
    await $fetch(`/api/users/${u.id}`, { method: 'PATCH', body: { displayName: editForm.displayName, username: editForm.username } })
    editOpenId.value = null
  }, 'Account updated.')
}
</script>

<template>
  <div data-testid="users-page">
    <PageHeader title="Users" subtitle="Who can use the store app" />

    <div class="page-shell page-shell--form space-y-4">
      <p v-if="message" data-testid="users-message" class="rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">{{ message }}</p>
      <p v-if="error" data-testid="users-error" class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">{{ error }}</p>

      <section class="space-y-2">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-ink-muted">Accounts</h2>
          <button type="button" data-testid="add-user-toggle" class="focus-ring text-sm font-semibold text-brand-600" @click="showAddForm = !showAddForm">
            {{ showAddForm ? 'Cancel' : '+ Add' }}
          </button>
        </div>

        <AppCard v-if="showAddForm" class="space-y-3">
          <AppField label="Display name" for="new-display-name">
            <input id="new-display-name" v-model="form.displayName" data-testid="new-user-display-name" type="text" class="field-input text-sm" />
          </AppField>
          <AppField label="Username" for="new-username">
            <input id="new-username" v-model="form.username" data-testid="new-user-username" type="text" autocomplete="off" class="field-input text-sm" />
          </AppField>
          <AppField label="Temporary password" hint="At least 6 characters. They must change it the first time they sign in." for="new-password">
            <input id="new-password" v-model="form.password" data-testid="new-user-password" type="password" autocomplete="new-password" class="field-input text-sm" />
          </AppField>
          <AppField label="Role" for="new-role">
            <select id="new-role" v-model="form.role" data-testid="new-user-role" class="field-input text-sm">
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </AppField>
          <AppButton
            block
            size="sm"
            :loading="busy"
            :disabled="busy || !form.displayName || !form.username || form.password.length < PASSWORD_MIN_LENGTH"
            data-testid="create-user"
            @click="createUser"
          >
            {{ busy ? 'Creating' : 'Create Account' }}
          </AppButton>
        </AppCard>

        <ul class="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          <li v-for="u in sorted" :key="u.id" :data-testid="`user-row-${u.username}`" class="px-4 py-3" :class="u.isActive ? '' : 'opacity-60'">
            <button
              type="button"
              class="focus-ring flex w-full items-start justify-between gap-3 text-left"
              :data-testid="`user-actions-toggle-${u.username}`"
              @click="openId = openId === u.id ? null : u.id"
            >
              <div>
                <p class="text-sm font-medium text-ink">{{ u.displayName }}</p>
                <p class="text-xs text-ink-subtle">@{{ u.username }}</p>
              </div>
              <div class="flex shrink-0 items-start gap-1">
                <div class="flex flex-wrap justify-end gap-1">
                  <AppBadge :data-testid="`user-role-${u.username}`" :tone="u.role === 'ADMIN' ? 'brand' : 'neutral'">{{ u.role }}</AppBadge>
                  <AppBadge v-if="!u.isActive" :data-testid="`user-status-${u.username}`" tone="danger">INACTIVE</AppBadge>
                  <AppBadge v-else-if="u.mustChangePassword" :data-testid="`user-temp-${u.username}`" tone="warn">TEMP PASSWORD</AppBadge>
                </div>
                <component :is="openId === u.id ? PhCaretUp : PhCaretDown" class="mt-0.5 h-4 w-4 text-ink-subtle" aria-hidden="true" />
              </div>
            </button>

            <div v-if="openId === u.id" class="mt-3 space-y-2 border-t border-line pt-3">
              <AppButton variant="secondary" block size="sm" data-testid="user-edit-toggle" :disabled="busy" @click="toggleEdit(u)">
                Edit Account
              </AppButton>
              <div v-if="editOpenId === u.id" class="space-y-2">
                <AppField label="Display name" :for="`edit-display-name-${u.id}`">
                  <input :id="`edit-display-name-${u.id}`" v-model="editForm.displayName" data-testid="user-edit-display-name" type="text" class="field-input text-sm" />
                </AppField>
                <AppField label="Username" :for="`edit-username-${u.id}`">
                  <input :id="`edit-username-${u.id}`" v-model="editForm.username" data-testid="user-edit-username" type="text" autocomplete="off" class="field-input text-sm" />
                </AppField>
                <AppButton
                  block
                  size="sm"
                  :loading="busy"
                  :disabled="busy || !editForm.displayName || !editForm.username"
                  data-testid="user-edit-submit"
                  @click="submitEdit(u)"
                >
                  Save Changes
                </AppButton>
              </div>

              <AppButton v-if="u.role === 'MEMBER'" variant="secondary" block size="sm" data-testid="user-make-admin" :disabled="busy" @click="setRole(u, 'ADMIN')">
                Make Admin
              </AppButton>
              <AppButton
                v-else
                variant="secondary"
                block
                size="sm"
                data-testid="user-make-member"
                :disabled="busy || isLastActiveAdmin(u)"
                @click="demote(u)"
              >
                Make Member
              </AppButton>

              <AppButton
                variant="secondary"
                block
                size="sm"
                data-testid="user-reset-toggle"
                :disabled="busy || u.id === myId"
                @click="toggleReset(u)"
              >
                Reset Access
              </AppButton>
              <div v-if="resetOpenId === u.id" class="space-y-2">
                <AppField
                  label="New temporary password"
                  :for="`reset-password-${u.id}`"
                  hint="At least 6 characters."
                  :error="resetLengthError ?? undefined"
                >
                  <PasswordField
                    :id="`reset-password-${u.id}`"
                    v-model="resetPassword"
                    testid="user-reset-password-input"
                    autocomplete="new-password"
                  />
                </AppField>
                <AppField label="Confirm temporary password" :for="`reset-confirm-password-${u.id}`" :error="resetMismatchError ?? undefined">
                  <PasswordField
                    :id="`reset-confirm-password-${u.id}`"
                    v-model="resetConfirmPassword"
                    testid="user-reset-confirm-password-input"
                    autocomplete="new-password"
                  />
                </AppField>
                <AppButton block size="sm" :loading="busy" :disabled="busy || !resetCanSubmit" data-testid="user-reset-submit" @click="submitReset(u)">
                  Reset Password
                </AppButton>
              </div>

              <AppButton
                v-if="u.isActive"
                variant="danger"
                block
                size="sm"
                data-testid="user-deactivate"
                :disabled="busy || isLastActiveAdmin(u)"
                @click="setActive(u, false)"
              >
                Deactivate
              </AppButton>
              <AppButton v-else variant="ghost" block size="sm" data-testid="user-reactivate" :disabled="busy" @click="setActive(u, true)">
                Reactivate
              </AppButton>
            </div>
          </li>
        </ul>

        <p class="text-xs text-ink-subtle">Deactivating keeps the person's past activity in the audit log.</p>
      </section>
    </div>
  </div>
</template>
