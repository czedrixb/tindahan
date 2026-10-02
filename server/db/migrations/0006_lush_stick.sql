CREATE TABLE "store_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"cost_price" integer,
	"selling_price" integer,
	"stock" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "stores" ("id", "code", "name") VALUES
  (1, 'DAVAO', 'Davao'),
  (2, 'MARAGUSAN', 'Maragusan');
--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('stores', 'id'), 2, true);
--> statement-breakpoint
CREATE TABLE "user_stores" (
	"user_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_stores_user_id_store_id_pk" PRIMARY KEY("user_id","store_id")
);
--> statement-breakpoint
DROP INDEX "sale_transactions_submission_key_unique";--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "store_id" integer;--> statement-breakpoint
ALTER TABLE "inventory_count_items" ADD COLUMN "store_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_counts" ADD COLUMN "store_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN "store_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_transactions" ADD COLUMN "store_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
INSERT INTO "user_stores" ("user_id", "store_id", "is_default")
SELECT "id", 1, true FROM "users";
--> statement-breakpoint
INSERT INTO "store_products" ("store_id", "product_id", "cost_price", "selling_price", "stock", "low_stock_threshold", "is_active", "created_at", "updated_at")
SELECT 1, "id", "cost_price", "selling_price", "stock", "low_stock_threshold", "is_active", "created_at", "updated_at" FROM "products";
--> statement-breakpoint
UPDATE "audit_logs" SET "store_id" = 1 WHERE "entity_type" = 'SALE';
--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_products_store_product_unique" ON "store_products" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "store_products_store_stock_idx" ON "store_products" USING btree ("store_id","stock");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_code_unique" ON "stores" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "user_stores_one_default" ON "user_stores" USING btree ("user_id") WHERE "user_stores"."is_default" = true;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_counts_id_store_unique" ON "inventory_counts" USING btree ("id","store_id");--> statement-breakpoint
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_inventory_count_id_store_id_inventory_counts_id_store_id_fk" FOREIGN KEY ("inventory_count_id","store_id") REFERENCES "public"."inventory_counts"("id","store_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_store_id_product_id_store_products_store_id_product_id_fk" FOREIGN KEY ("store_id","product_id") REFERENCES "public"."store_products"("store_id","product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_store_id_product_id_store_products_store_id_product_id_fk" FOREIGN KEY ("store_id","product_id") REFERENCES "public"."store_products"("store_id","product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_transactions" ADD CONSTRAINT "sale_transactions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_transactions_store_created_idx" ON "inventory_transactions" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_transactions_store_submission_key_unique" ON "sale_transactions" USING btree ("store_id","submission_key");--> statement-breakpoint
CREATE INDEX "sale_transactions_store_sold_at_idx" ON "sale_transactions" USING btree ("store_id","sold_at");
