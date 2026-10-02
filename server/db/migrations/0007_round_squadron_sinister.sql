ALTER TABLE "inventory_count_items" ALTER COLUMN "store_id" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "inventory_counts" ALTER COLUMN "store_id" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ALTER COLUMN "store_id" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "sale_transactions" ALTER COLUMN "store_id" SET DEFAULT 1;