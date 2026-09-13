import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test('unauthenticated visitors are redirected to the account sign-in screen', async ({ page }) => {
  await page.goto('/')
  // The intended destination round-trips through ?redirect= so sign-in can
  // send the user back where they meant to go.
  await expect(page).toHaveURL(/\/login\?redirect=%2F$|\/login\?redirect=\/$/)
  await expect(page.getByText('Your store, ready for the day.')).toBeVisible()
})

test('incorrect account credentials are rejected', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Username').fill('admin')
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByText('Incorrect username or password')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('a server error on login shows a server-error message, not "incorrect password"', async ({ page }) => {
  // Regression test: a 500 (e.g. the unapplied-migration bug this covers) used to
  // render as "Incorrect username or password" - see apiErrorMessage in
  // app/utils/format.ts. Simulate the 500 at the network layer since the E2E
  // harness always runs against a freshly-migrated database and can't reproduce
  // real schema drift.
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ statusCode: 500, statusMessage: 'Internal Server Error' }) }),
  )
  await page.goto('/login')
  await page.getByLabel('Username').fill('admin')
  await page.getByLabel('Password', { exact: true }).fill('1234test')

  if (process.env.AUTH_SCREENSHOT_DIR) {
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByText('Something went wrong on our end. Please try again.')).toBeVisible()
    await page.screenshot({ path: `${process.env.AUTH_SCREENSHOT_DIR}/login-server-error.png`, fullPage: true })
    return
  }

  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByText('Something went wrong on our end. Please try again.')).toBeVisible()
  await expect(page.getByText('Incorrect username or password')).not.toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('the correct account credentials admit the user to the dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Username').fill('admin')
  await page.getByLabel('Password', { exact: true }).fill('1234test')
  if (process.env.AUTH_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.AUTH_SCREENSHOT_DIR}/before-http-login.png`, fullPage: true })
  }
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByText('Today', { exact: true })).toBeVisible()

  if (process.env.AUTH_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.AUTH_SCREENSHOT_DIR}/after-http-login.png`, fullPage: true })
  }

  const sessionCookie = (await page.context().cookies()).find(({ name }) => name === 'sari_session')
  expect(sessionCookie).toMatchObject({ httpOnly: true, secure: false, sameSite: 'Lax' })

  const dashboardResponse = await page.request.get('/api/dashboard/today')
  expect(dashboardResponse.status()).toBe(200)
})
