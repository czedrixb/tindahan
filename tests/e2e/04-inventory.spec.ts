import { test, expect } from '@playwright/test'
import { createProduct } from './helpers'

test('product search placeholder clears its leading icon', async ({ page }) => {
  await page.goto('/sales/new')

  const search = page.getByPlaceholder('Search product...')
  await expect(search).toBeVisible()

  await expect(search).toHaveCSS('padding-left', '52px')
  const [searchBox, iconBox] = await Promise.all([search.boundingBox(), page.locator('.relative > svg').boundingBox()])
  expect(searchBox).not.toBeNull()
  expect(iconBox).not.toBeNull()
  expect(searchBox!.x + 52).toBeGreaterThan(iconBox!.x + iconBox!.width + 12)
})

test('products and bottom navigation stay tappable on a populated mobile inventory', async ({ page, request }) => {
  const product = await createProduct(request, { name: `Nav Tap ${Date.now()}`, stock: 12 })
  await Promise.all(Array.from({ length: 12 }, (_, index) => createProduct(request, {
    name: `Scrollable Inventory ${Date.now()} ${index}`,
    stock: 12,
  })))

  await page.goto('/inventory')
  const productLink = page.getByRole('link', { name: new RegExp(product.name) })
  await expect(productLink).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'Primary' })
  await expect(nav).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect(page.getByPlaceholder('Search inventory...')).toBeInViewport()
  const screenshotPath = process.env.NAV_SCREENSHOT_PATH
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true })

  await productLink.tap()
  await expect(page).toHaveURL(`/products/${product.id}`)

  await page.goto('/inventory')
  await expect(page.getByRole('link', { name: new RegExp(product.name) })).toBeVisible()
  await nav.getByRole('link', { name: 'Home' }).tap()

  await expect(page).toHaveURL('/')
})

test('receiving stock increases the product quantity', async ({ page, request }) => {
  const product = await createProduct(request, { name: 'RestockMe', stock: 5 })

  await page.goto(`/products/${product.id}`)
  await expect(page.getByText('5', { exact: true })).toBeVisible()

  await page.getByPlaceholder('Quantity received').fill('24')
  await page.getByRole('button', { name: '+ Add' }).click()
  await expect(page.getByText('Stock received.')).toBeVisible()

  const refreshed = await (await request.get(`/api/products/${product.id}`)).json()
  expect(refreshed.stock).toBe(29)
})

test('unsaved product details survive receiving and adjusting stock', async ({ page, request }) => {
  const product = await createProduct(request, {
    name: 'Draft Details Product',
    variant: 'Original variant',
    costPrice: 500,
    sellingPrice: 800,
    stock: 5,
    lowStockThreshold: 2,
  })

  await page.goto(`/products/${product.id}`)

  const name = page.getByLabel('Product Name')
  const variant = page.getByLabel('Variant')
  const cost = page.getByLabel('Cost Price (₱)')
  const selling = page.getByLabel('Selling Price (₱)')
  const threshold = page.getByLabel('Low Stock Threshold')

  await name.fill('Unsaved product name')
  await variant.fill('Unsaved variant')
  await cost.fill('6.25')
  await selling.fill('9.75')
  await threshold.fill('4')

  await page.getByPlaceholder('Quantity received').fill('3')
  await page.getByRole('button', { name: '+ Add' }).click()
  await expect(page.getByText('Stock received.')).toBeVisible()

  const draftScreenshotPath = process.env.INVENTORY_DRAFT_SCREENSHOT_PATH
  if (draftScreenshotPath) await page.screenshot({ path: draftScreenshotPath, fullPage: true })

  for (const [field, value] of [
    [name, 'Unsaved product name'],
    [variant, 'Unsaved variant'],
    [cost, '6.25'],
    [selling, '9.75'],
    [threshold, '4'],
  ] as const) {
    await expect(field).toHaveValue(value)
  }

  await page.getByPlaceholder('Quantity', { exact: true }).fill('1')
  await page.getByPlaceholder('Reason').fill('Damaged during delivery')
  await page.getByRole('button', { name: 'Save Adjustment' }).click()
  await page.getByTestId('confirm-accept').click()
  await expect(page.getByText('Adjustment recorded.')).toBeVisible()

  for (const [field, value] of [
    [name, 'Unsaved product name'],
    [variant, 'Unsaved variant'],
    [cost, '6.25'],
    [selling, '9.75'],
    [threshold, '4'],
  ] as const) {
    await expect(field).toHaveValue(value)
  }

  const refreshed = await (await request.get(`/api/products/${product.id}`)).json()
  expect(refreshed.stock).toBe(7)
  expect(refreshed.name).toBe('Draft Details Product')
  expect(refreshed.costPrice).toBe(500)
})

test('swiping over a mobile inventory row scrolls without opening the product', async ({ page, request }) => {
  const products = await Promise.all(Array.from({ length: 18 }, (_, index) => createProduct(request, {
    name: `Swipe Guard Product ${String(index).padStart(2, '0')}`,
    costPrice: 500,
    sellingPrice: 800,
    stock: 12,
  })))

  await page.goto('/inventory')
  const productLink = page.getByRole('link', { name: new RegExp(products[0].name) })
  await expect(productLink).toBeVisible()

  const box = await productLink.boundingBox()
  expect(box).not.toBeNull()
  const x = box!.x + box!.width / 2
  const startY = box!.y + box!.height / 2
  const cdp = await page.context().newCDPSession(page)

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: startY }],
  })
  for (const y of [startY - 40, startY - 90, startY - 150, startY - 220]) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y }],
    })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(300)
  const scrollY = await page.evaluate(() => window.scrollY)

  const scrollScreenshotPath = process.env.INVENTORY_SCROLL_SCREENSHOT_PATH
  if (scrollScreenshotPath) await page.screenshot({ path: scrollScreenshotPath, fullPage: true })

  await expect(page).toHaveURL('/inventory')
  expect(scrollY).toBeGreaterThan(0)

  await productLink.tap()
  await expect(page).toHaveURL(`/products/${products[0].id}`)
})

test('a weekly inventory count computes differences and applies them on completion', async ({ page, request }) => {
  const product = await createProduct(request, { name: 'CountMe', stock: 28 })

  await page.goto('/inventory/count')
  await page.getByRole('button', { name: '+ Start New Count' }).click()
  await expect(page).toHaveURL(/\/inventory\/count\/\d+$/)

  const row = page.locator('tr', { hasText: 'CountMe' })
  await expect(row).toBeVisible()
  await expect(row.locator('td').nth(1)).toHaveText('28')

  await row.getByTestId('count-actual-input').fill('25')
  await row.getByTestId('count-actual-input').blur()
  await expect(row.locator('td').nth(3)).toHaveText('-3')

  await page.getByTestId('complete-count').click()
  await page.getByTestId('confirm-accept').click()
  await expect(page.getByText('Completed')).toBeVisible()

  const refreshed = await (await request.get(`/api/products/${product.id}`)).json()
  expect(refreshed.stock).toBe(25)
})
