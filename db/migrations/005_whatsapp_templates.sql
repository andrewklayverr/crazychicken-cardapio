SET NAMES utf8mb4;

ALTER TABLE store_settings
  ADD COLUMN whatsapp_template VARCHAR(20) NOT NULL DEFAULT 'complete' AFTER whatsapp_number;
