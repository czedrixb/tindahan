import { test, expect } from '@playwright/test'
import { createProduct } from './helpers'
import fs from 'node:fs'
import path from 'node:path'

// Desktop-only coverage for the sidebar workspace introduced by
// docs/2026-09-13-pos-redesign.md ("Replace the phone-width application
// wrapper with a responsive workspace"). Runs only on the desktop-chrome
// project (playwright.config.ts) - every other spec here targets the mobile
// viewport and stays on mobile-chrome/mobile-webkit.

test('the sidebar replaces the bottom nav at desktop width', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  await expect(nav).toBeVisible()
  await expect(nav).toHaveCount(1)

  // The bottom nav's tab labels (Home/Sale/Stock/Reports/More) are replaced
  // by the sidebar's own labels (Overview/New sale/...), so a link literally
  // named "Home" should no longer be present anywhere in the DOM at this
  // width - the mobile BottomNav is display:none, not just visually hidden.
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'Overview' })).toBeVisible()
})

test('sidebar links navigate the workspace', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Primary' })

  await nav.getByRole('link', { name: 'Inventory' }).click()
  await expect(page).toHaveURL('/inventory')
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible()

  await nav.getByRole('link', { name: 'New sale' }).click()
  await expect(page).toHaveURL('/sales/new')
  await expect(page.getByRole('heading', { name: 'New sale' })).toBeVisible()

  await nav.getByRole('link', { name: 'Reports' }).click()
  await expect(page).toHaveURL('/reports')
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()
})

test('new sale keeps the product list and current-sale panel side by side', async ({ page, request }) => {
  const product = await createProduct(request, { name: 'DesktopCheckoutItem', costPrice: 500, sellingPrice: 900, stock: 10 })

  await page.goto('/sales/new')
  await page.getByTestId('product-search').fill(product.name)
  await page.getByTestId('search-result').first().click()

  const cartPanel = page.getByText('Current sale')
  await expect(cartPanel).toBeVisible()

  const [searchBox, cartBox] = await Promise.all([
    page.getByTestId('product-search').boundingBox(),
    cartPanel.boundingBox(),
  ])
  expect(searchBox).not.toBeNull()
  expect(cartBox).not.toBeNull()
  // Side by side, not stacked: the cart panel sits to the right of the
  // search column rather than below it.
  expect(cartBox!.x).toBeGreaterThan(searchBox!.x + searchBox!.width)
})

test('inventory renders as an aligned table at desktop width', async ({ page, request }) => {
  await createProduct(request, { name: 'DesktopInventoryItem', variant: '250 g', costPrice: 800, sellingPrice: 1200, stock: 15 })

  await page.goto('/inventory')
  await page.getByPlaceholder('Search inventory...').fill('DesktopInventoryItem')

  const row = page.locator('tr', { hasText: 'DesktopInventoryItem' })
  await expect(row).toBeVisible()
  await expect(row.getByText('250 g')).toBeVisible()
  await expect(row.getByText('₱12.00')).toBeVisible()
})

test('inventory paginates, capitalizes labels, and sorts from every column header', async ({ page }) => {
  const products = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    name: `sort item ${String(index).padStart(2, '0')}`,
    variant: `box ${String(12 - index).padStart(2, '0')}`,
    stock: 12 - index,
    lowStockThreshold: 2,
    costPrice: index === 0 ? null : (index + 1) * 100,
    sellingPrice: index === 1 ? null : (index + 1) * 150,
    isActive: true,
    createdAt: '2026-09-24T00:00:00.000Z',
    updatedAt: '2026-09-24T00:00:00.000Z',
  }))

  await page.route('**/api/products?**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(products) }))
  await page.goto('/inventory')

  const table = page.getByRole('table')
  await expect(table.locator('tbody tr')).toHaveCount(10)
  await expect(table.getByText('Sort Item 00', { exact: true })).toBeVisible()
  await expect(table.getByText('Box 12', { exact: true })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: /Product/ })).toHaveAttribute('aria-sort', 'ascending')

  await page.getByRole('navigation', { name: 'Inventory pages' }).getByRole('button', { name: 'Next page' }).click()
  await expect(table.locator('tbody tr')).toHaveCount(2)

  await table.getByRole('button', { name: /Product/ }).click()
  await expect(table.locator('tbody tr').first()).toContainText('Sort Item 11')
  await expect(table.getByRole('columnheader', { name: /Product/ })).toHaveAttribute('aria-sort', 'descending')

  await table.getByRole('button', { name: /In stock/ }).click()
  await expect(table.locator('tbody tr').first()).toContainText('1')

  await table.getByRole('button', { name: /^Cost/ }).click()
  await table.getByRole('button', { name: /^Cost/ }).click()
  await expect(table.locator('tbody tr').first()).toContainText('₱12.00')
  await page.getByRole('navigation', { name: 'Inventory pages' }).getByRole('button', { name: 'Next page' }).click()
  await expect(table.locator('tbody tr').last()).toContainText('Needs pricing')

  const screenshotDir = process.env.E2E_SCREENSHOT_DIR
  if (screenshotDir) {
    fs.mkdirSync(screenshotDir, { recursive: true })
    await page.screenshot({ path: path.join(screenshotDir, 'after-inventory.png'), fullPage: true })
  }
})
