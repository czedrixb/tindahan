import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

function dashboardFixture() {
  return {
    date: '2026-09-24',
    revenue: 18500,
    cost: 10100,
    profit: 8400,
    itemsSold: 18,
    transactions: 6,
    lowStock: Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      name: `restock product ${index + 1}`,
      variant: 'family pack',
      costPrice: 100,
      sellingPrice: 200,
      stock: index,
      lowStockThreshold: 5,
      isActive: true,
      createdAt: '2026-09-24T00:00:00.000Z',
      updatedAt: '2026-09-24T00:00:00.000Z',
    })),
    recentSales: Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      revenue: 2500 + index * 100,
      soldAt: `2026-09-24T0${index + 1}:00:00.000Z`,
      lines: index === 0
        ? [
            { id: 1, productId: 21, productName: 'brown sugar', productVariant: 'large pouch', quantity: 3 },
            { id: 2, productId: 22, productName: 'instant coffee', productVariant: 'original blend', quantity: 2 },
          ]
        : [{ id: index + 2, productId: index + 30, productName: `sale product ${index + 1}`, productVariant: 'single pack', quantity: index + 1 }],
    })),
  }
}

async function openStubbedOverview(page: Page) {
  await page.goto('/inventory')
  await page.route('**/api/dashboard/today', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(dashboardFixture()) }))
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Home' }).click()
}

test('overview shows product quantities and independently paginates both panels', async ({ page }) => {
  await openStubbedOverview(page)

  await expect(page.getByText('Restock Product 1')).toBeVisible()
  await expect(page.getByText('Family Pack').first()).toBeVisible()
  await expect(page.getByText('Brown Sugar')).toBeVisible()
  await expect(page.getByText('Large Pouch')).toBeVisible()
  await expect(page.getByText('Brown Sugar').locator('..').getByText('×3')).toBeVisible()
  await expect(page.getByText('Instant Coffee')).toBeVisible()
  await expect(page.getByText('Instant Coffee').locator('..').getByText('×2')).toBeVisible()

  const restockPager = page.getByRole('navigation', { name: 'Needs restocking pages' })
  const recentPager = page.getByRole('navigation', { name: 'Recent sales pages' })
  await expect(restockPager).toBeVisible()
  await expect(recentPager).toBeVisible()

  await restockPager.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByText('Restock Product 6')).toBeVisible()
  await expect(page.getByText('Brown Sugar')).toBeVisible()

  await recentPager.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByText('Sale Product 6')).toBeVisible()

  const screenshotDir = process.env.E2E_SCREENSHOT_DIR
  if (screenshotDir) {
    fs.mkdirSync(screenshotDir, { recursive: true })
    await page.screenshot({ path: path.join(screenshotDir, 'after-overview.png'), fullPage: true })
  }
})
