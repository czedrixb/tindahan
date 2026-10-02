import { test, expect, request as playwrightRequest } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { BASE_URL } from './global-setup'

const shots = path.resolve(process.cwd(), 'test-results/multi-store')

test('admin switches stores while product stock and sales remain isolated', async ({ page }) => {
  mkdirSync(shots, { recursive: true })
  await page.goto('/')
  const session = await (await page.request.get('/api/auth/session')).json()
  const davao = session.stores.find((store: { code: string }) => store.code === 'DAVAO')
  const maragusan = session.stores.find((store: { code: string }) => store.code === 'MARAGUSAN')
  expect(davao).toBeTruthy()
  expect(maragusan).toBeTruthy()

  const suffix = Date.now()
  const sharedSubmissionKey = `multi-store-${suffix}`
  const created = await page.request.post('/api/products', { data: {
    name: `Multi Store Sardines ${suffix}`, variant: '155g', costPrice: 1200,
    sellingPrice: 1500, stock: 8, lowStockThreshold: 2,
  } })
  expect(created.ok()).toBeTruthy()
  const davaoProduct = await created.json()

  await page.screenshot({ path: path.join(shots, 'before-store-switch.png'), fullPage: true })
  const switcher = page.locator('[data-testid="store-switcher"]:visible')
  await switcher.selectOption(String(maragusan.id))
  await expect(switcher).toHaveValue(String(maragusan.id))
  await page.screenshot({ path: path.join(shots, 'after-store-switch.png'), fullPage: true })

  const emptyAtMaragusan = await page.request.get('/api/products', { params: { q: `Multi Store Sardines ${suffix}` } })
  expect(await emptyAtMaragusan.json()).toEqual([])

  const attached = await page.request.post('/api/products', { data: {
    name: `Multi Store Sardines ${suffix}`, variant: '155g', costPrice: 1300,
    sellingPrice: 1700, stock: 20, lowStockThreshold: 4,
  } })
  expect(attached.ok()).toBeTruthy()
  const maragusanProduct = await attached.json()
  expect(maragusanProduct.id).toBe(davaoProduct.id)

  const sale = await page.request.post('/api/sales', { data: {
    items: [{ productId: maragusanProduct.id, quantity: 3 }],
    cashReceived: 10000,
    submissionKey: sharedSubmissionKey,
  } })
  expect(sale.ok()).toBeTruthy()
  expect((await page.request.get(`/api/products/${maragusanProduct.id}`)).json()).resolves.toMatchObject({ stock: 17, sellingPrice: 1700 })

  expect((await page.request.post('/api/stores/active', { data: { storeId: davao.id } })).ok()).toBeTruthy()
  expect((await page.request.get(`/api/products/${davaoProduct.id}`)).json()).resolves.toMatchObject({ stock: 8, sellingPrice: 1500 })
  expect(await (await page.request.get('/api/sales')).json()).toEqual([])
  const davaoSale = await page.request.post('/api/sales', { data: {
    items: [{ productId: davaoProduct.id, quantity: 1 }], cashReceived: 5000,
    submissionKey: sharedSubmissionKey,
  } })
  expect(davaoSale.ok()).toBeTruthy()
  expect((await davaoSale.json()).id).not.toBe((await sale.json()).id)
  const combined = await (await page.request.get('/api/reports/daily', { params: { store: 'all' } })).json()
  expect(combined.revenue).toBe(6600)
})

test('switching stores refreshes the current inventory view without reloading the browser', async ({ page }) => {
  await page.goto('/inventory')
  const session = await (await page.request.get('/api/auth/session')).json()
  const davao = session.stores.find((store: { code: string }) => store.code === 'DAVAO')
  const maragusan = session.stores.find((store: { code: string }) => store.code === 'MARAGUSAN')
  expect(davao).toBeTruthy()
  expect(maragusan).toBeTruthy()

  const suffix = Date.now()
  const productName = `Live Store Switch ${suffix}`
  await page.locator('[data-testid="store-switcher"]:visible').selectOption(String(davao.id))
  const created = await page.request.post('/api/products', { data: {
    name: productName, variant: 'UI test', costPrice: 1000,
    sellingPrice: 1200, stock: 7, lowStockThreshold: 2,
  } })
  expect(created.ok()).toBeTruthy()

  const search = page.getByPlaceholder('Search inventory...')
  await search.fill(productName)
  const visibleProduct = page.locator('a:visible').filter({ hasText: productName })
  await expect(visibleProduct).toBeVisible()
  await page.screenshot({ path: path.join(shots, 'inventory-before-live-switch.png'), fullPage: true })

  await page.locator('[data-testid="store-switcher"]:visible').selectOption(String(maragusan.id))
  await expect(page.locator('[data-testid="store-switcher"]:visible')).toHaveValue(String(maragusan.id))
  await expect(visibleProduct).toHaveCount(0)
  await page.screenshot({ path: path.join(shots, 'inventory-after-live-switch.png'), fullPage: true })
})

test('a Davao-only member cannot switch to Maragusan directly', async ({ page }) => {
  const suffix = Date.now()
  const username = `davao-${suffix}`
  const temporaryPassword = 'temporary-pass'
  const password = 'changed-pass'
  const created = await page.request.post('/api/users', { data: {
    username, displayName: 'Davao Operator', password: temporaryPassword,
    role: 'MEMBER', storeIds: [1], defaultStoreId: 1,
  } })
  expect(created.ok()).toBeTruthy()

  const member = await playwrightRequest.newContext({ baseURL: BASE_URL })
  expect((await member.post('/api/auth/login', { data: { username, password: temporaryPassword } })).ok()).toBeTruthy()
  expect((await member.post('/api/account/password', { data: {
    currentPassword: temporaryPassword, newPassword: password, confirmPassword: password,
  } })).ok()).toBeTruthy()
  const denied = await member.post('/api/stores/active', { data: { storeId: 2 } })
  expect(denied.status()).toBe(403)
  await member.dispose()
})
