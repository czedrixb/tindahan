import { sql } from 'drizzle-orm'
import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
  primaryKey,
  foreignKey,
} from 'drizzle-orm/pg-core'

export const userRoles = ['ADMIN', 'MEMBER'] as const
export type UserRole = (typeof userRoles)[number]

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    role: text('role', { enum: userRoles }).notNull().default('MEMBER'),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    // Baked into the signed session token (server/utils/auth.ts) and checked
    // on every request (server/utils/current-user.ts). Bumping this is the
    // only way to invalidate a user's existing cookies - there is no
    // server-side session store. Bumped on an admin password reset and on a
    // self-service password change.
    sessionEpoch: integer('session_epoch').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_username_unique').on(sql`lower(${table.username})`)],
)

export const stores = pgTable(
  'stores',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('stores_code_unique').on(table.code)],
)

export const userStores = pgTable(
  'user_stores',
  {
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    storeId: integer('store_id').notNull().references(() => stores.id, { onDelete: 'restrict' }),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.storeId] }),
    uniqueIndex('user_stores_one_default').on(table.userId).where(sql`${table.isDefault} = true`),
  ],
)

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  description: text('description').notNull(),
  storeId: integer('store_id').references(() => stores.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const transactionTypes = [
  'SALE',
  'RESTOCK',
  'ADJUSTMENT',
  'DAMAGE',
  'EXPIRED',
  'MISSING',
] as const
export type TransactionType = (typeof transactionTypes)[number]

export const countStatuses = ['IN_PROGRESS', 'COMPLETED'] as const
export type CountStatus = (typeof countStatuses)[number]

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    variant: text('variant').notNull().default(''),
    // Integer centavos. Null = not yet priced (e.g. fresh Excel import).
    costPrice: integer('cost_price'),
    sellingPrice: integer('selling_price'),
    stock: integer('stock').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('products_name_variant_unique').on(
      sql`lower(${table.name})`,
      sql`lower(${table.variant})`,
    ),
  ],
)

export const storeProducts = pgTable(
  'store_products',
  {
    id: serial('id').primaryKey(),
    storeId: integer('store_id').notNull().references(() => stores.id, { onDelete: 'restrict' }),
    productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
    costPrice: integer('cost_price'),
    sellingPrice: integer('selling_price'),
    stock: integer('stock').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('store_products_store_product_unique').on(table.storeId, table.productId),
    index('store_products_store_stock_idx').on(table.storeId, table.stock),
  ],
)

export const saleTransactions = pgTable(
  'sale_transactions',
  {
    id: serial('id').primaryKey(),
    storeId: integer('store_id').notNull().default(1).references(() => stores.id, { onDelete: 'restrict' }),
    // Client-generated idempotency key. Nullable for historical rows; a
    // repeated key returns the existing receipt instead of recording a duplicate.
    submissionKey: text('submission_key'),
    // Cash payment for the whole receipt. Nullable so historical rows
    // backfilled from single-item sales remain valid without inventing payment values.
    cashReceived: integer('cash_received'),
    changeDue: integer('change_due'),
    // Snapshots of the receipt total — never recalculated from current prices.
    revenue: integer('revenue').notNull(),
    profit: integer('profit').notNull(),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    soldAt: timestamp('sold_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sale_transactions_store_submission_key_unique').on(table.storeId, table.submissionKey),
    index('sale_transactions_store_sold_at_idx').on(table.storeId, table.soldAt),
  ],
)

export const sales = pgTable('sales', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id')
    .notNull()
    .references(() => saleTransactions.id, { onDelete: 'restrict' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  quantity: integer('quantity').notNull(),
  // Snapshots at the time of sale — never recalculated from the product's current price.
  costPrice: integer('cost_price').notNull(),
  sellingPrice: integer('selling_price').notNull(),
  revenue: integer('revenue').notNull(),
  profit: integer('profit').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const inventoryTransactions = pgTable('inventory_transactions', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  storeId: integer('store_id').notNull().default(1).references(() => stores.id, { onDelete: 'restrict' }),
  type: text('type', { enum: transactionTypes }).notNull(),
  quantity: integer('quantity').notNull(),
  previousStock: integer('previous_stock').notNull(),
  newStock: integer('new_stock').notNull(),
  reason: text('reason'),
  saleId: integer('sale_id').references(() => sales.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.storeId, table.productId], foreignColumns: [storeProducts.storeId, storeProducts.productId] }),
  index('inventory_transactions_store_created_idx').on(table.storeId, table.createdAt),
])

export const inventoryCounts = pgTable('inventory_counts', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id').notNull().default(1).references(() => stores.id, { onDelete: 'restrict' }),
  countDate: timestamp('count_date', { withTimezone: true }).notNull().defaultNow(),
  status: text('status', { enum: countStatuses }).notNull().default('IN_PROGRESS'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [uniqueIndex('inventory_counts_id_store_unique').on(table.id, table.storeId)])

export const inventoryCountItems = pgTable('inventory_count_items', {
  id: serial('id').primaryKey(),
  inventoryCountId: integer('inventory_count_id')
    .notNull()
    .references(() => inventoryCounts.id, { onDelete: 'cascade' }),
  storeId: integer('store_id').notNull().default(1).references(() => stores.id, { onDelete: 'restrict' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  expectedQuantity: integer('expected_quantity').notNull(),
  actualQuantity: integer('actual_quantity'),
  difference: integer('difference'),
}, (table) => [
  foreignKey({ columns: [table.inventoryCountId, table.storeId], foreignColumns: [inventoryCounts.id, inventoryCounts.storeId] }),
  foreignKey({ columns: [table.storeId, table.productId], foreignColumns: [storeProducts.storeId, storeProducts.productId] }),
])
