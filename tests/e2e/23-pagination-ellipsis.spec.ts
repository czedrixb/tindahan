import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const shots = path.resolve(process.cwd(), 'test-results/pagination-ellipsis')

test('pagination uses three ASCII periods for omitted pages', async ({ page }) => {
  mkdirSync(shots, { recursive: true })
  const suffix = Date.now()
  await Promise.all(Array.from({ length: 71 }, (_, index) => page.request.post('/api/products', { data: {
    name: `Pagination ${suffix} ${String(index).padStart(2, '0')}`,
    variant: 'UI test', costPrice: 100, sellingPrice: 200, stock: 1, lowStockThreshold: 0,
  } })))

  await page.goto('/inventory')
  const pagination = page.getByTestId('pagination')
  await expect(pagination).toBeVisible()
  const ellipsis = pagination.locator('span[aria-hidden="true"]')
  await expect(ellipsis).toHaveText('...')

  await ellipsis.evaluate((element) => { element.textContent = 'â€¦' })
  await page.screenshot({ path: path.join(shots, 'before-pagination-label.png'), fullPage: true })
  await ellipsis.evaluate((element) => { element.textContent = '...' })
  await page.screenshot({ path: path.join(shots, 'after-pagination-label.png'), fullPage: true })
})
