import { boolean, int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull().unique(),
  sortOrder: int("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("category_id").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description").notNull(),
  priceCents: int("price_cents").notNull(),
  imageKey: varchar("image_key", { length: 255 }),
  badge: varchar("badge", { length: 60 }),
  available: boolean("available").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export const productOptions = mysqlTable("product_options", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("product_id").notNull(),
  groupName: varchar("group_name", { length: 100 }).notNull(),
  label: varchar("label", { length: 120 }).notNull(),
  priceDeltaCents: int("price_delta_cents").notNull().default(0),
  required: boolean("required").notNull().default(false),
  selectionMode: varchar("selection_mode", { length: 20 }).notNull().default("single"),
  minSelections: int("min_selections").notNull().default(0),
  maxSelections: int("max_selections").notNull().default(1),
  active: boolean("active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
});

export const storeSettings = mysqlTable("store_settings", {
  id: int("id").primaryKey().default(1),
  brandName: varchar("brand_name", { length: 100 }).notNull().default("Crazy Chicken"),
  logoKey: varchar("logo_key", { length: 255 }),
  whatsappNumber: varchar("whatsapp_number", { length: 30 }),
  address: varchar("address", { length: 255 }).notNull().default("Rua 7 de Setembro, 247 · Suzano"),
  openingHours: varchar("opening_hours", { length: 140 }).notNull().default("18h às 23h"),
  orderingMode: varchar("ordering_mode", { length: 20 }).notNull().default("open"),
  weeklyScheduleJson: text("weekly_schedule_json"),
  deliveryEnabled: boolean("delivery_enabled").notNull().default(true),
  pickupEnabled: boolean("pickup_enabled").notNull().default(true),
  minimumOrderCents: int("minimum_order_cents").notNull().default(0),
  defaultDeliveryFeeCents: int("default_delivery_fee_cents").notNull().default(0),
  theme: varchar("theme", { length: 50 }).notNull().default("cartaz-amarelo"),
  appearanceJson: text("appearance_json").notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export const deliveryZones = mysqlTable("delivery_zones", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  feeCents: int("fee_cents").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 60 }).notNull().unique(),
  status: varchar("status", { length: 40 }).notNull().default("received"),
  fulfillmentType: varchar("fulfillment_type", { length: 20 }).notNull(),
  customerName: varchar("customer_name", { length: 120 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 40 }).notNull(),
  address: varchar("address", { length: 255 }),
  neighborhood: varchar("neighborhood", { length: 100 }),
  notes: text("notes"),
  subtotalCents: int("subtotal_cents").notNull(),
  deliveryFeeCents: int("delivery_fee_cents").notNull().default(0),
  totalCents: int("total_cents").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull().unique(),
  whatsappSentAt: timestamp("whatsapp_sent_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull(),
  productId: int("product_id").notNull(),
  productName: varchar("product_name", { length: 160 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPriceCents: int("unit_price_cents").notNull(),
  optionsJson: text("options_json").notNull(),
  itemNotes: text("item_notes"),
});

export const adminAllowlist = mysqlTable("admin_allowlist", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 190 }).notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const adminUsers = mysqlTable("admin_users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 190 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("attendant"),
  status: varchar("status", { length: 20 }).notNull().default("invited"),
  passwordHash: text("password_hash"),
  mfaSecretEncrypted: text("mfa_secret_encrypted"),
  mfaEnabledAt: timestamp("mfa_enabled_at", { mode: "string" }),
  failedLoginCount: int("failed_login_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { mode: "string" }),
  lastLoginAt: timestamp("last_login_at", { mode: "string" }),
  createdBy: int("created_by"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export const adminSessions = mysqlTable("admin_sessions", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  userId: int("user_id").notNull(),
  csrfTokenHash: varchar("csrf_token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
  idleExpiresAt: timestamp("idle_expires_at", { mode: "string" }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { mode: "string" }).defaultNow().notNull(),
  revokedAt: timestamp("revoked_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const adminTokens = mysqlTable("admin_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  type: varchar("type", { length: 30 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
  usedAt: timestamp("used_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const adminRecoveryCodes = mysqlTable("admin_recovery_codes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  codeHash: varchar("code_hash", { length: 64 }).notNull().unique(),
  usedAt: timestamp("used_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const adminLoginThrottles = mysqlTable("admin_login_throttles", {
  keyHash: varchar("key_hash", { length: 64 }).primaryKey(),
  attempts: int("attempts").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { mode: "string" }).notNull(),
  blockedUntil: timestamp("blocked_until", { mode: "string" }),
});

export const auditLog = mysqlTable("audit_log", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: varchar("actor_user_id", { length: 190 }).notNull(),
  actorEmail: varchar("actor_email", { length: 190 }).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  entity: varchar("entity", { length: 80 }).notNull(),
  entityId: varchar("entity_id", { length: 120 }),
  metadataJson: text("metadata_json").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});
