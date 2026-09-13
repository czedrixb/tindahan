import { test, expect } from '@playwright/test'
import { createProduct } from './helpers'
import { formatPeso } from '../../app/utils/format'
import fs from 'node:fs'

test('daily and weekly reports reflect recorded sales', async ({ page, request }) => {
  const before = await (await request.get('/api/reports/daily')).json()
  const beforeWeek = await (await request.get('/api/reports/weekly')).json()

  const product = await createProduct(request, { name: 'ReportCheck', costPrice: 300, sellingPrice: 500, stock: 20 })
  const sale = await (
    await request.post('/api/sales', {
      data: { items: [{ productId: product.id, quantity: 4 }], cashReceived: 2000, submissionKey: `report-check-${Date.now()}` },
    })
  ).json()
  expect(sale).toMatchObject({ revenue: 2000, profit: 800 })

  const after = await (await request.get('/api/reports/daily')).json()
  expect(after.revenue - before.revenue).toBe(2000)
  expect(after.profit - before.profit).toBe(800)
  expect(after.itemsSold - before.itemsSold).toBe(4)

  const afterWeek = await (await request.get('/api/reports/weekly')).json()
  expect(afterWeek.revenue - beforeWeek.revenue).toBe(2000)

  await page.goto('/reports')
  await expect(page.getByText('Sales', { exact: true })).toBeVisible()
  await expect(page.getByText(formatPeso(after.profit))).toBeVisible()
})

test('inventory and sales can be exported to Excel', async ({ page }) => {
  await page.goto('/settings')
  const [inventoryDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Export Current Inventory').click(),
  ])
  expect(inventoryDownload.suggestedFilename()).toMatch(/^inventory-.*\.xlsx$/)
  const inventoryPath = await inventoryDownload.path()
  expect(inventoryPath).not.toBeNull()
  expect(fs.statSync(inventoryPath!).size).toBeGreaterThan(0)

  await page.goto('/reports')
  const [salesDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Export' }).click(),
  ])
  expect(salesDownload.suggestedFilename()).toMatch(/^sales-.*\.xlsx$/)
  const salesPath = await salesDownload.path()
  expect(salesPath).not.toBeNull()
  expect(fs.statSync(salesPath!).size).toBeGreaterThan(0)
})
