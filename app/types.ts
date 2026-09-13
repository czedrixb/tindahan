export type UserRole = 'ADMIN' | 'MEMBER'

export interface StoreUser {
  id: number
  username: string
  displayName: string
  role: UserRole
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
}

export interface SessionResponse {
  authenticated: boolean
  user: Pick<StoreUser, 'id' | 'username' | 'displayName' | 'role' | 'mustChangePassword'> | null
}

export interface Product {
  id: number
  name: string
  variant: string
  costPrice: number | null
  sellingPrice: number | null
  stock: number
  lowStockThreshold: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Sale {
  id: number
  transactionId: number
  productId: number
  productName: string
  productVariant: string
  quantity: number
  costPrice: number
  sellingPrice: number
  revenue: number
  profit: number
  cashReceived: number | null
  changeDue: number | null
  voidedAt: string | null
  soldAt: string
}

export interface SaleReceiptLine {
  id: number
  transactionId: number
  productId: number
  productName: string
  productVariant: string
  quantity: number
  costPrice: number
  sellingPrice: number
  revenue: number
  profit: number
  previousStock: number
  newStock: number
}

export interface SaleReceipt {
  id: number
  submissionKey: string | null
  cashReceived: number | null
  changeDue: number | null
  revenue: number
  profit: number
  voidedAt: string | null
  soldAt: string
  createdAt: string
  alreadyRecorded?: boolean
  lines: SaleReceiptLine[]
}

export interface RecentSale {
  id: number
  revenue: number
  soldAt: string
}

export interface DashboardSummary {
  date: string
  revenue: number
  cost: number
  profit: number
  itemsSold: number
  transactions: number
  lowStock: Product[]
  recentSales: RecentSale[]
}

export interface SalesTotals {
  revenue: number
  cost: number
  profit: number
  itemsSold: number
  transactions: number
}

export interface DailySalesPoint {
  date: string
  revenue: number
}

export interface TopProduct {
  productId: number
  name: string
  variant: string
  quantitySold: number
  revenue: number
}

export interface WeeklyReport extends SalesTotals {
  start: string
  end: string
  series: DailySalesPoint[]
  topProducts: TopProduct[]
}

export interface MonthlyReport extends SalesTotals {
  start: string
  end: string
  series: DailySalesPoint[]
  topProducts: TopProduct[]
  lowestStock: Product[]
}

export type CountStatus = 'IN_PROGRESS' | 'COMPLETED'

export interface InventoryCount {
  id: number
  countDate: string
  status: CountStatus
  createdAt: string
  completedAt: string | null
}

export interface InventoryCountItem {
  id: number
  productId: number
  productName: string
  productVariant: string
  expectedQuantity: number
  actualQuantity: number | null
  difference: number | null
}

export interface InventoryCountDetail extends InventoryCount {
  items: InventoryCountItem[]
}

export interface ImportPreviewRow {
  rowNumber: number
  name: string
  variant: string
  quantity: number
  costPrice: number | null
  sellingPrice: number | null
  warning?: string
  action: 'create' | 'update'
  existingProductId: number | null
  existingStock: number | null
}

export interface ImportPreview {
  hasHeader: boolean
  hasPrices: boolean
  totalRows: number
  toCreate: number
  toUpdate: number
  rows: ImportPreviewRow[]
}
