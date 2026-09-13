import path from 'node:path'
import { test, expect } from '@playwright/test'

const screenshotDir = process.env.AUDIT_SCREENSHOT_DIR

test('a named account is shown on actions in the audit log, which is scoped to sales', async ({ page }) => {
  const suffix = Date.now().toString().slice(-6)
  const username = `clerk${suffix}`
  const displayName = `Clerk ${suffix}`
  const password = 'clerk-pass-123'

  const account = await page.request.post('/api/users', { data: { username, displayName, password, role: 'ADMIN' } })
  expect(account.ok()).toBeTruthy()

  await page.context().clearCookies()
  await page.goto('/login')
  await expect(page.getByText('Your store, ready for the day.')).toBeVisible()
  if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'after-account-login.png'), fullPage: true })

  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()

  // Admin-created accounts carry a temporary password and are forced through
  // a one-time change before they can use the rest of the app.
  await expect(page).toHaveURL('/settings/password')
  await page.getByTestId('current-password').fill(password)
  await page.getByTestId('new-password').fill(`${password}-new`)
  await page.getByTestId('confirm-password').fill(`${password}-new`)
  await page.getByTestId('submit-password').click()
  await expect(page).toHaveURL('/')

  // Creating a product is not a sale or a void - it must never reach the
  // audit log, which this work scoped down to sales activity only.
  const productName = `Audit Product ${suffix}`
  const product = await page.request.post('/api/products', {
    data: { name: productName, variant: '', costPrice: 100, sellingPrice: 150, stock: 10, lowStockThreshold: 5 },
  })
  expect(product.ok()).toBeTruthy()
  const { id: productId } = await product.json()

  const auditAfterProductCreate = await page.request.get('/api/audit')
  expect(await auditAfterProductCreate.json()).toEqual(
    expect.not.arrayContaining([expect.objectContaining({ entityType: 'PRODUCT' })]),
  )

  // A sale, by contrast, is exactly what the audit log exists to show.
  const sale = await page.request.post('/api/sales', {
    data: {
      items: [{ productId, quantity: 2 }],
      cashReceived: 300,
      submissionKey: `audit-test-${suffix}`,
    },
  })
  expect(sale.ok()).toBeTruthy()

  await page.goto('/settings/audit')
  const entry = page.getByRole('listitem').filter({ hasText: `Recorded sale of 2 × ${productName}` })
  await expect(entry).toContainText(displayName)
  await expect(entry).toContainText(`@${username}`)
  if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'after-audit-log.png'), fullPage: true })
})
