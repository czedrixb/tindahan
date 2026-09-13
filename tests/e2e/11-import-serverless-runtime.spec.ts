import { expect, test } from '@playwright/test'

const INVENTORY_XLSX = 'D:/Downloads/inventory-071326.xlsx'
// Opt-in only, matching the repo's own convention (see 15-visual-redesign.spec.ts) -
// this spec must not write into test-results/ on every run.
const SCREENSHOT_DIR = process.env.IMPORT_SCREENSHOT_DIR

test('Excel upload returns an import preview without a server error', async ({ page }) => {
  await page.goto('/settings')

  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/import-serverless-runtime-before.png`, fullPage: true })

  await page.getByTestId('import-file-input').setInputFiles(INVENTORY_XLSX)

  const preview = page.getByTestId('import-preview')
  await expect(preview).toBeVisible()
  // 296 is a fixed property of this workbook, so it always holds. Whether
  // those rows come back as "new" or "to update" depends on whatever an
  // earlier spec already imported into this suite's shared database (e.g.
  // 02-import.spec.ts imports this exact file) - this test is only about the
  // upload parsing without a server error, not about database state left by
  // other specs, so assert the split adds up to the whole rather than a
  // specific new/update count.
  await expect(preview).toContainText('296 rows found')
  const previewText = await preview.innerText()
  const counts = previewText.match(/(\d+) new, (\d+) to update/)
  expect(counts).not.toBeNull()
  const [, created, updated] = counts!
  expect(Number(created) + Number(updated)).toBe(296)
  await expect(page.getByText('Could not read file')).not.toBeVisible()

  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/import-serverless-runtime-after.png`, fullPage: true })
})
