SET NAMES utf8mb4;

ALTER TABLE product_options
  ADD COLUMN selection_mode VARCHAR(20) NOT NULL DEFAULT 'single' AFTER required,
  ADD COLUMN min_selections INT NOT NULL DEFAULT 0 AFTER selection_mode,
  ADD COLUMN max_selections INT NOT NULL DEFAULT 1 AFTER min_selections;

ALTER TABLE order_items
  ADD COLUMN item_notes TEXT NULL AFTER options_json;

UPDATE product_options
SET min_selections = 1,
    max_selections = 1,
    selection_mode = 'single'
WHERE required = 1;
