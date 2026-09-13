import type { APIRequestContext, Page } from '@playwright/test'

export interface ProductInput {
  name: string
  variant?: string
  costPrice?: number | null
  sellingPrice?: number | null
  stock?: number
  lowStockThreshold?: number
}

export async function createProduct(request: APIRequestContext, input: ProductInput) {
  const response = await request.post('/api/products', {
    data: {
      variant: '',
      costPrice: null,
      sellingPrice: null,
      stock: 0,
      lowStockThreshold: 5,
      ...input,
    },
  })
  if (!response.ok()) {
    throw new Error(`createProduct failed: ${response.status()} ${await response.text()}`)
  }
  return response.json()
}

export interface UserInput {
  username: string
  displayName: string
  password: string
  role?: 'ADMIN' | 'MEMBER'
}

export async function createUser(request: APIRequestContext, input: UserInput) {
  const response = await request.post('/api/users', { data: input })
  if (!response.ok()) {
    throw new Error(`createUser failed: ${response.status()} ${await response.text()}`)
  }
  return response.json()
}

export async function loginAs(page: Page, username: string, password: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('Username').fill(username)
  // exact: true - a substring match would also catch the show/hide toggle's
  // aria-label="Show password" (login.vue's PasswordField).
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
}
