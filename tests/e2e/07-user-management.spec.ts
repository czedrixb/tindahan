import path from 'node:path'
import { request, test, expect } from '@playwright/test'
import { createUser, loginAs } from './helpers'
import { BASE_URL, E2E_USERNAME, STORAGE_STATE_PATH } from './global-setup'

const screenshotDir = process.env.USERS_SCREENSHOT_DIR

test.describe('admin: managing users', () => {
  test('an admin sees user management on the More page', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByTestId('manage-users-link')).toBeVisible()
    await expect(page.getByText('View Audit Log')).toBeVisible()
    await expect(page.getByTestId('my-role')).toHaveText('Admin')
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'after-more-page.png'), fullPage: true })

    await page.getByTestId('manage-users-link').click()
    await expect(page).toHaveURL('/settings/users')
    await expect(page.getByTestId(`user-row-${E2E_USERNAME}`)).toBeVisible()
    await expect(page.getByTestId(`user-role-${E2E_USERNAME}`)).toHaveText('ADMIN')
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'after-manage-users.png'), fullPage: true })
  })

  test('an admin creates a member with a temporary password', async ({ page, request: adminRequest }) => {
    const suffix = Date.now().toString().slice(-6)
    const username = `member${suffix}`
    const displayName = `Member ${suffix}`

    await page.goto('/settings/users')
    await page.getByTestId('add-user-toggle').click()
    await page.getByTestId('new-user-display-name').fill(displayName)
    await page.getByTestId('new-user-username').fill(username)
    await page.getByTestId('new-user-password').fill('member-temp-123')
    await page.getByTestId('new-user-role').selectOption('MEMBER')
    await page.getByTestId('create-user').click()

    await expect(page.getByTestId(`user-row-${username}`)).toBeVisible()
    await expect(page.getByTestId(`user-role-${username}`)).toHaveText('MEMBER')
    await expect(page.getByTestId(`user-temp-${username}`)).toBeVisible()
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'after-user-created.png'), fullPage: true })

    // The audit log is scoped to sales and voids only - user management
    // actions (including this creation) must never appear in it.
    const audit = await adminRequest.get('/api/audit')
    expect(audit.ok()).toBeTruthy()
    const entries = await audit.json()
    expect(entries).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ entityType: 'USER' })]),
    )
  })

  test('role change, access reset, and deactivation work end to end', async ({ page, request: adminRequest }) => {
    const suffix = Date.now().toString().slice(-6)
    const username = `rowuser${suffix}`
    const displayName = `Row User ${suffix}`
    await createUser(adminRequest, { username, displayName, password: 'row-temp-123', role: 'MEMBER' })

    await page.goto('/settings/users')
    // The actions drawer, once opened, stays open across these calls — it is
    // only closed programmatically by Deactivate/Reactivate. Toggling it again
    // here would close it and hide the very buttons the next step needs.
    await page.getByTestId(`user-actions-toggle-${username}`).click()

    await page.getByTestId('user-make-admin').click()
    await expect(page.getByTestId(`user-role-${username}`)).toHaveText('ADMIN')
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'after-role-changed.png'), fullPage: true })

    await page.getByTestId('user-reset-toggle').click()
    await page.getByTestId('user-reset-password-input').fill('row-temp-456')
    await page.getByTestId('user-reset-confirm-password-input').fill('row-temp-456')
    await page.getByTestId('user-reset-submit').click()
    await page.getByTestId('confirm-accept').click()
    await expect(page.getByTestId(`user-temp-${username}`)).toBeVisible()

    await page.getByTestId('user-make-member').click()
    await page.getByTestId('confirm-accept').click()
    await page.getByTestId('user-deactivate').click()
    await page.getByTestId('confirm-accept').click()
    await expect(page.getByTestId(`user-status-${username}`)).toBeVisible()
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'after-user-deactivated.png'), fullPage: true })

    // None of the above (role change, reset, deactivate) reach the audit log.
    const audit = await adminRequest.get('/api/audit')
    const entries = await audit.json()
    expect(entries).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ entityType: 'USER' })]),
    )

    const anon = await request.newContext({ baseURL: BASE_URL })
    const loginAttempt = await anon.post('/api/auth/login', { data: { username, password: 'row-temp-456' } })
    expect(loginAttempt.status()).toBe(401)
    await anon.dispose()
  })

  test('the reset drawer flags a mismatched confirmation before it can be submitted', async ({ page, request: adminRequest }) => {
    const suffix = Date.now().toString().slice(-6)
    const username = `mismatch${suffix}`
    await createUser(adminRequest, { username, displayName: `Mismatch ${suffix}`, password: 'mismatch-temp-123', role: 'MEMBER' })

    await page.goto('/settings/users')
    await page.getByTestId(`user-actions-toggle-${username}`).click()
    await page.getByTestId('user-reset-toggle').click()
    await page.getByTestId('user-reset-password-input').fill('new-temp-password-1')
    await page.getByTestId('user-reset-confirm-password-input').fill('new-temp-password-2')

    await expect(page.getByText('Passwords do not match')).toBeVisible()
    await expect(page.getByTestId('user-reset-submit')).toBeDisabled()
  })

  test('a non-admin cannot reset another account\'s password via a direct request', async ({ request: adminRequest }) => {
    const suffix = Date.now().toString().slice(-6)
    const memberPassword = 'plain-member-temp-1'
    const member = await createUser(adminRequest, {
      username: `plainmember${suffix}`,
      displayName: `Plain Member ${suffix}`,
      password: memberPassword,
      role: 'MEMBER',
    })
    const target = await createUser(adminRequest, {
      username: `hijacktarget${suffix}`,
      displayName: `Hijack Target ${suffix}`,
      password: 'hijack-target-temp-1',
      role: 'MEMBER',
    })

    const memberContext = await request.newContext({ baseURL: BASE_URL })
    await memberContext.post('/api/auth/login', { data: { username: member.username, password: memberPassword } })
    // Clear the new account's own forced password-change lock first, so the
    // 403 below is unambiguously about admin authorization, not the
    // unrelated mustChangePassword gate.
    const freshPassword = 'plain-member-real-1'
    await memberContext.post('/api/account/password', {
      data: { currentPassword: memberPassword, newPassword: freshPassword, confirmPassword: freshPassword },
    })

    const attempt = await memberContext.post(`/api/users/${target.id}/reset-password`, {
      data: { password: 'hijacked-password-1', confirmPassword: 'hijacked-password-1' },
    })
    expect(attempt.status()).toBe(403)

    await memberContext.dispose()
  })

  test("resetting an active account's password rejects the old password and invalidates its existing session immediately", async ({
    request: adminRequest,
  }) => {
    const suffix = Date.now().toString().slice(-6)
    const originalPassword = 'session-temp-123'
    const member = await createUser(adminRequest, {
      username: `sessioncheck${suffix}`,
      displayName: `Session Check ${suffix}`,
      password: originalPassword,
      role: 'MEMBER',
    })

    const memberContext = await request.newContext({ baseURL: BASE_URL })
    await memberContext.post('/api/auth/login', { data: { username: member.username, password: originalPassword } })
    const chosenPassword = 'session-real-456'
    await memberContext.post('/api/account/password', {
      data: { currentPassword: originalPassword, newPassword: chosenPassword, confirmPassword: chosenPassword },
    })

    // The session is fully active and ordinary right up until the reset.
    expect((await memberContext.get('/api/dashboard/today')).status()).toBe(200)

    const newTempPassword = 'session-reset-789'
    const reset = await adminRequest.post(`/api/users/${member.id}/reset-password`, {
      data: { password: newTempPassword, confirmPassword: newTempPassword },
    })
    expect(reset.ok()).toBeTruthy()

    // The existing cookie is rejected on its very next request - this is an
    // active, non-deactivated account, so this proves session invalidation
    // rather than the isActive check.
    expect((await memberContext.get('/api/dashboard/today')).status()).toBe(401)

    // The password chosen before the reset no longer works.
    const oldPasswordLogin = await memberContext.post('/api/auth/login', {
      data: { username: member.username, password: chosenPassword },
    })
    expect(oldPasswordLogin.status()).toBe(401)

    // The new temporary password works and forces another change.
    const newLogin = await memberContext.post('/api/auth/login', {
      data: { username: member.username, password: newTempPassword },
    })
    expect(newLogin.ok()).toBeTruthy()
    expect((await newLogin.json()).user.mustChangePassword).toBe(true)

    await memberContext.dispose()
  })

  test('an admin edits a member\'s display name and username', async ({ page, request: adminRequest }) => {
    const suffix = Date.now().toString().slice(-6)
    const username = `editme${suffix}`
    const displayName = `Edit Me ${suffix}`
    await createUser(adminRequest, { username, displayName, password: 'edit-temp-123', role: 'MEMBER' })

    const newDisplayName = `Edited Name ${suffix}`
    const newUsername = `edited${suffix}`

    await page.goto('/settings/users')
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'before-user-edit.png'), fullPage: true })

    await page.getByTestId(`user-actions-toggle-${username}`).click()
    await page.getByTestId('user-edit-toggle').click()
    await page.getByTestId('user-edit-display-name').fill(newDisplayName)
    await page.getByTestId('user-edit-username').fill(newUsername)
    await page.getByTestId('user-edit-submit').click()

    await expect(page.getByTestId(`user-row-${newUsername}`)).toBeVisible()
    await expect(page.getByTestId(`user-row-${newUsername}`)).toContainText(newDisplayName)
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'after-user-edit.png'), fullPage: true })

    // Editing a profile is not a sale or a void - it must not reach the
    // audit log.
    const audit = await adminRequest.get('/api/audit')
    const entries = await audit.json()
    expect(entries).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ entityType: 'USER' })]),
    )

    const anon = await request.newContext({ baseURL: BASE_URL })
    const loginAsEdited = await anon.post('/api/auth/login', { data: { username: newUsername, password: 'edit-temp-123' } })
    expect(loginAsEdited.ok()).toBeTruthy()
    await anon.dispose()
  })

  test('the last active admin cannot be demoted or deactivated', async ({ request: adminRequest }) => {
    const usersResponse = await adminRequest.get('/api/users')
    const users = await usersResponse.json()
    const admin = users.find((u: { username: string }) => u.username === E2E_USERNAME)

    // Neutralize any other active admins earlier specs may have left behind
    // (06-account-audit.spec.ts creates an admin-role clerk account), so this
    // test's "only one active admin" premise holds regardless of suite order.
    const otherActiveAdmins = users.filter(
      (u: { id: number; role: string; isActive: boolean }) => u.role === 'ADMIN' && u.isActive && u.id !== admin.id,
    )
    for (const other of otherActiveAdmins) {
      await adminRequest.patch(`/api/users/${other.id}`, { data: { role: 'MEMBER' } })
    }

    const demote = await adminRequest.patch(`/api/users/${admin.id}`, { data: { role: 'MEMBER' } })
    expect(demote.status()).toBe(409)
    expect(await demote.text()).toContain('last active admin')

    const deactivate = await adminRequest.patch(`/api/users/${admin.id}`, { data: { isActive: false } })
    expect(deactivate.status()).toBe(409)
    expect(await deactivate.text()).toContain('last active admin')

    const suffix = Date.now().toString().slice(-6)
    const secondAdmin = await createUser(adminRequest, {
      username: `second-admin${suffix}`,
      displayName: `Second Admin ${suffix}`,
      password: 'second-admin-123',
      role: 'ADMIN',
    })
    expect(secondAdmin.role).toBe('ADMIN')

    // With a second active admin present, demoting *that* admin succeeds —
    // proving the guard is genuinely conditional, not a blanket 403. This
    // demotes the second admin rather than the primary `admin` account: had
    // we demoted `admin` (using `admin`'s own session), the account would
    // instantly lose admin rights on its very next request — authorization is
    // re-read from the DB every request, not cached in the session token —
    // and every later spec in this shared-database suite logs in as `admin`
    // expecting full access.
    const demoteSecondAdmin = await adminRequest.patch(`/api/users/${secondAdmin.id}`, { data: { role: 'MEMBER' } })
    expect(demoteSecondAdmin.ok()).toBeTruthy()
  })
})

test.describe('member: onboarding and permissions', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('a new member must change their password before using the app, and keeps store access without admin access', async ({ page }) => {
    const adminContext = await request.newContext({ baseURL: BASE_URL, storageState: STORAGE_STATE_PATH })
    const suffix = Date.now().toString().slice(-6)
    const username = `newmember${suffix}`
    const displayName = `New Member ${suffix}`
    const tempPassword = 'onboard-temp-123'
    await createUser(adminContext, { username, displayName, password: tempPassword, role: 'MEMBER' })

    await loginAs(page, username, tempPassword)
    await expect(page).toHaveURL('/settings/password')
    await expect(page.getByText('Set your password')).toBeVisible()
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'before-forced-password-change.png'), fullPage: true })

    // Server lock proof: store routes are 403'd, not just hidden client-side.
    const lockedResponse = await page.request.get('/api/products')
    expect(lockedResponse.status()).toBe(403)

    // No-bypass / no-loop proof: navigating elsewhere bounces right back.
    await page.goto('/')
    await expect(page).toHaveURL('/settings/password')

    // Reuse rejection: "changing" to the same password again is refused.
    await page.getByTestId('current-password').fill(tempPassword)
    await page.getByTestId('new-password').fill(tempPassword)
    await page.getByTestId('confirm-password').fill(tempPassword)
    await page.getByTestId('submit-password').click()
    await expect(page.getByTestId('password-error')).toContainText('different from your current one')

    const newPassword = 'member-real-456'
    await page.getByTestId('current-password').fill(tempPassword)
    await page.getByTestId('new-password').fill(newPassword)
    await page.getByTestId('confirm-password').fill(newPassword)
    await page.getByTestId('submit-password').click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Today', { exact: true })).toBeVisible()
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'after-forced-password-change.png'), fullPage: true })

    // Members keep full store access…
    const productsOk = await page.request.get('/api/products')
    expect(productsOk.ok()).toBeTruthy()
    const createOk = await page.request.post('/api/products', {
      data: { name: `Member Product ${suffix}`, variant: '', costPrice: 50, sellingPrice: 80, stock: 0, lowStockThreshold: 5 },
    })
    expect(createOk.ok()).toBeTruthy()

    // …but not the admin-only surface.
    expect((await page.request.get('/api/users')).status()).toBe(403)
    expect((await page.request.get('/api/audit')).status()).toBe(403)

    await page.goto('/settings')
    await expect(page.getByTestId('manage-users-link')).toHaveCount(0)
    await expect(page.getByText('View Audit Log')).toHaveCount(0)
    await expect(page.getByTestId('my-role')).toHaveText('Member')
    await expect(page.getByTestId('change-password-link')).toBeVisible()
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'after-more-member.png'), fullPage: true })

    await page.goto('/settings/users')
    await expect(page).toHaveURL('/settings')
    await page.goto('/settings/audit')
    await expect(page).toHaveURL('/settings')

    await adminContext.dispose()
  })
})
