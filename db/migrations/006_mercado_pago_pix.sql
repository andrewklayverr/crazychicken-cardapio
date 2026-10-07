SET NAMES utf8mb4;

ALTER TABLE orders
  ADD COLUMN customer_email VARCHAR(190) NULL AFTER customer_phone,
  ADD COLUMN payment_method VARCHAR(30) NOT NULL DEFAULT 'pay_on_fulfillment' AFTER total_cents,
  ADD COLUMN payment_status VARCHAR(30) NOT NULL DEFAULT 'not_requested' AFTER payment_method,
  ADD COLUMN mercado_pago_order_id VARCHAR(120) NULL AFTER payment_status,
  ADD COLUMN mercado_pago_payment_id VARCHAR(120) NULL AFTER mercado_pago_order_id,
  ADD COLUMN pix_br_code LONGTEXT NULL AFTER mercado_pago_payment_id,
  ADD COLUMN pix_qr_code_base64 LONGTEXT NULL AFTER pix_br_code,
  ADD COLUMN pix_payment_link_url VARCHAR(500) NULL AFTER pix_qr_code_base64,
  ADD COLUMN pix_expires_at TIMESTAMP NULL AFTER pix_payment_link_url,
  ADD COLUMN pix_paid_at TIMESTAMP NULL AFTER pix_expires_at,
  ADD COLUMN payment_updated_at TIMESTAMP NULL AFTER pix_paid_at,
  ADD UNIQUE INDEX orders_mercado_pago_order_unique (mercado_pago_order_id),
  ADD INDEX orders_payment_status_idx (payment_status);
