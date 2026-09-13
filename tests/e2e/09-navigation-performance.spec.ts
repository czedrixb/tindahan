import { test, expect } from '@playwright/test'

test('warm navigation reuses the hydrated session and renders Home while its data is pending', async ({ page }) => {
  let sessionRequests = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/auth/session') sessionRequests++
  })

  await page.goto('/inventory')
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible()
  const beforeNavigation = sessionRequests

  let releaseDashboard!: () => void
  const dashboardHeld = new Promise<void>((resolve) => { releaseDashboard = resolve })
  await page.route('**/api/dashboard/today', async (route) => {
    await dashboardHeld
    // Amounts are centavos end-to-end (see formatPeso in app/utils/format.ts) -
    // 12500 centavos renders as ₱125.00, not 125.
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ date: '2026-09-10', revenue: 12500, cost: 5000, profit: 7500, itemsSold: 2, transactions: 1, lowStock: [] }),
    })
  })

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Home' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(page.locator('.skeleton').first()).toBeVisible()
  expect(sessionRequests).toBe(beforeNavigation)

  releaseDashboard()
  await expect(page.getByText('₱125.00')).toBeVisible()
})

test('inventory ignores an older filter response that finishes after the latest one', async ({ page }) => {
  let releaseOld!: () => void
  const oldHeld = new Promise<void>((resolve) => { releaseOld = resolve })
  let requests = 0
  await page.route('**/api/products?**', async (route) => {
    requests++
    if (requests === 1) {
      await oldHeld
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 1, name: 'Old result', variant: '', stock: 1, lowStockThreshold: 5, isActive: true, costPrice: null, sellingPrice: null }]) })
      return
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 2, name: 'Latest result', variant: '', stock: 2, lowStockThreshold: 5, isActive: true, costPrice: null, sellingPrice: null }]) })
  })

  await page.goto('/inventory')
  await expect.poll(() => requests).toBe(1)
  await page.getByPlaceholder('Search inventory...').fill('latest')
  await expect.poll(() => requests).toBe(2)
  // Scoped to the mobile row list - the same product also renders in the
  // desktop table (hidden at this viewport via CSS, but still present in the
  // DOM), and getByText matches DOM text regardless of visibility.
  const mobileRows = page.locator('ul')
  await expect(mobileRows.getByText('Latest result')).toBeVisible()

  releaseOld()
  await expect(page.getByText('Old result')).toHaveCount(0)
  await expect(mobileRows.getByText('Latest result')).toBeVisible()
})
