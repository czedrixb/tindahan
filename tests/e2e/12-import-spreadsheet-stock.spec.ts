import { test, expect } from '@playwright/test'

const INVENTORY_XLSX = 'D:/Downloads/aug_15_simplified_import_99.xlsx'

test('imports spreadsheet quantities by default and keeps the confirmation sheet centered over the app', async ({ page, request }) => {
  await page.goto('/settings')
  await page.getByTestId('import-file-input').setInputFiles(INVENTORY_XLSX)

  const preview = page.getByTestId('import-preview')
  await expect(preview).toContainText('414 rows found')
  await expect(page.getByTestId('import-stock-toggle')).toBeChecked()

  const previewText = await preview.innerText()
  const counts = previewText.match(/(\d+) new, (\d+) to update/)
  expect(counts).not.toBeNull()
  const [, created, updated] = counts!

  await page.getByTestId('confirm-import').click()
  const dialog = page.getByTestId('confirm-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('sets their stock to the quantities in the spreadsheet')

  const sheet = dialog.locator('[role="alertdialog"]')
  const sheetBox = await sheet.boundingBox()
  const viewport = page.viewportSize()
  expect(sheetBox).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(Math.abs((sheetBox!.x + sheetBox!.width / 2) - viewport!.width / 2)).toBeLessThanOrEqual(1)
  expect(sheetBox!.y + sheetBox!.height).toBeGreaterThanOrEqual(viewport!.height - 1)

  await page.getByTestId('confirm-accept').click()
  await expect(page.getByTestId('import-result')).toContainText(`Created ${created}, updated ${updated}, skipped 0`)

  // q matches name OR variant (see server/api/products/index.get.ts), so this
  // can also pick up an unrelated product from another spec's fixture whose
  // variant happens to contain "lucky 7" (e.g. 02-import.spec.ts's workbook
  // has a "sardines" product with variant "lucky 7") when specs share one
  // database. Filter to the exact product this import created.
  const lucky7 = await request.get('/api/products', { params: { q: 'Lucky 7' } })
  const lucky7Rows = (await lucky7.json()).filter((p: { name: string }) => p.name === 'Lucky 7')
  expect(lucky7Rows).toHaveLength(1)
  expect(lucky7Rows[0].stock).toBe(99)
})
