import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  priceCents: integer("price_cents").notNull(),
  imageKey: text("image_key"),
  badge: text("badge"),
  available: integer("available", { mode: "boolean" }).notNull().default(true),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const productOptions = sqliteTable("product_options", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull(),
  groupName: text("group_name").notNull(),
  label: text("label").notNull(),
  priceDeltaCents: integer("price_delta_cents").notNull().default(0),
  required: integer("required", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const storeSettings = sqliteTable("store_settings", {
  id: integer("id").primaryKey().default(1),
  brandName: text("brand_name").notNull().default("Crazy Chicken"),
  logoKey: text("logo_key"),
  whatsappNumber: text("whatsapp_number"),
  address: text("address").notNull().default("Rua 7 de Setembro, 247 · Suzano"),
  openingHours: text("opening_hours").notNull().default("18h às 23h"),
  deliveryEnabled: integer("delivery_enabled", { mode: "boolean" }).notNull().default(true),
  pickupEnabled: integer("pickup_enabled", { mode: "boolean" }).notNull().default(true),
  minimumOrderCents: integer("minimum_order_cents").notNull().default(0),
  defaultDeliveryFeeCents: integer("default_delivery_fee_cents").notNull().default(0),
  theme: text("theme").notNull().default("cartaz-amarelo"),
  appearanceJson: text("appearance_json").notNull().default("{}"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const deliveryZones = sqliteTable("delivery_zones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  feeCents: integer("fee_cents").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  status: text("status").notNull().default("received"),
  fulfillmentType: text("fulfillment_type").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  address: text("address"),
  neighborhood: text("neighborhood"),
  notes: text("notes"),
  subtotalCents: integer("subtotal_cents").notNull(),
  deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  whatsappSentAt: text("whatsapp_sent_at"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  optionsJson: text("options_json").notNull().default("[]"),
});

export const adminAllowlist = sqliteTable("admin_allowlist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorUserId: text("actor_user_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});
