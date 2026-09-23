SET NAMES utf8mb4;

ALTER TABLE store_settings
  ADD COLUMN ordering_mode VARCHAR(20) NOT NULL DEFAULT 'open' AFTER opening_hours,
  ADD COLUMN weekly_schedule_json LONGTEXT NULL AFTER ordering_mode;
