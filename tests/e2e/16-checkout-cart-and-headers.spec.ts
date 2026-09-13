import { test, expect } from '@playwright/test'
import { createProduct } from './helpers'

test('adding a second product does not reload the catalog or bury the cart', async ({ page, request }) => {
  await createProduct(request, { name: 'ResetCheckA', costPrice: 500, sellingPrice: 900, stock: 10 })
  await createProduct(request, { name: 'ResetCheckB', costPrice: 300, sellingPrice: 600, stock: 10 })

  await page.goto('/sales/new')
  // Idle state is either the plain hint or a browse list of frequently-sold
  // products (app/pages/sales/new.vue) depending on what earlier specs have
  // already sold in this shared database - assert the search box itself
  // rather than which idle state is showing.
  await expect(page.getByTestId('product-search')).toBeVisible()

  await page.getByTestId('product-search').fill('ResetCheckA')
  await page.getByTestId('search-result').first().click()
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  // Adding clears the search box; the result list must stay empty instead of
  // silently reloading the whole product catalog on top of the cart.
  await expect(page.getByTestId('search-result')).toHaveCount(0)
  await expect(page.getByTestId('product-search')).toHaveValue('')

  await page.getByTestId('product-search').fill('ResetCheckB')
  await page.getByTestId('search-result').first().click()
  await expect(page.getByTestId('cart-line')).toHaveCount(2)
  await expect(page.getByTestId('search-result')).toHaveCount(0)

  await expect(page.getByTestId('cart-line')).toContainText(['ResetCheckA', 'ResetCheckB'])
  await expect(page.getByTestId('sale-total')).toBeInViewport()
})

test('removing a product keeps the cart visible with no stale results', async ({ page, request }) => {
  await createProduct(request, { name: 'RemoveVisibleA', costPrice: 500, sellingPrice: 900, stock: 10 })
  await createProduct(request, { name: 'RemoveVisibleB', costPrice: 300, sellingPrice: 600, stock: 10 })

  await page.goto('/sales/new')
  await page.getByTestId('product-search').fill('RemoveVisibleA')
  await page.getByTestId('search-result').first().click()
  await page.getByTestId('product-search').fill('RemoveVisibleB')
  await page.getByTestId('search-result').first().click()
  await expect(page.getByTestId('cart-line')).toHaveCount(2)

  await page.getByTestId('cart-line-remove').first().click()
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await expect(page.getByTestId('search-result')).toHaveCount(0)
  await expect(page.getByTestId('cart-line')).toBeVisible()
})

test('the cart survives leaving /sales/new and the leave prompt says it will not be lost', async ({ page, request }) => {
  const product = await createProduct(request, { name: 'PersistCart', costPrice: 500, sellingPrice: 900, stock: 10 })

  await page.goto('/sales/new')
  await page.getByTestId('product-search').fill(product.name)
  await page.getByTestId('search-result').first().click()
  await expect(page.getByTestId('cart-line')).toHaveCount(1)

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Stock' }).click()
  await expect(page.getByTestId('confirm-dialog')).toBeVisible()
  await expect(page.getByTestId('confirm-dialog')).not.toContainText('clears them')
  await page.getByTestId('confirm-accept').click()
  await expect(page).toHaveURL('/inventory')

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Sale' }).click()
  await expect(page).toHaveURL('/sales/new')
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await expect(page.getByTestId('cart-line')).toContainText(product.name)
})

test('staying on the leave prompt keeps the cashier on /sales/new', async ({ page, request }) => {
  const product = await createProduct(request, { name: 'StayOnSale', costPrice: 500, sellingPrice: 900, stock: 10 })

  await page.goto('/sales/new')
  await page.getByTestId('product-search').fill(product.name)
  await page.getByTestId('search-result').first().click()

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Stock' }).click()
  await expect(page.getByTestId('confirm-dialog')).toBeVisible()
  await page.getByTestId('confirm-cancel').click()
  await expect(page.getByTestId('confirm-dialog')).toHaveCount(0)
  await expect(page).toHaveURL('/sales/new')
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
})
