SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  price_cents INT NOT NULL,
  image_key VARCHAR(255) NULL,
  badge VARCHAR(60) NULL,
  available TINYINT(1) NOT NULL DEFAULT 1,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX products_category_idx (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  group_name VARCHAR(100) NOT NULL,
  label VARCHAR(120) NOT NULL,
  price_delta_cents INT NOT NULL DEFAULT 0,
  required TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  INDEX product_options_product_idx (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_settings (
  id INT PRIMARY KEY DEFAULT 1,
  brand_name VARCHAR(100) NOT NULL DEFAULT 'Crazy Chicken',
  logo_key VARCHAR(255) NULL,
  whatsapp_number VARCHAR(30) NULL,
  address VARCHAR(255) NOT NULL DEFAULT 'Rua 7 de Setembro, 247 · Suzano',
  opening_hours VARCHAR(140) NOT NULL DEFAULT '18h às 23h',
  delivery_enabled TINYINT(1) NOT NULL DEFAULT 1,
  pickup_enabled TINYINT(1) NOT NULL DEFAULT 1,
  minimum_order_cents INT NOT NULL DEFAULT 0,
  default_delivery_fee_cents INT NOT NULL DEFAULT 0,
  theme VARCHAR(50) NOT NULL DEFAULT 'cartaz-amarelo',
  appearance_json LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delivery_zones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  fee_cents INT NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,
  status VARCHAR(40) NOT NULL DEFAULT 'received',
  fulfillment_type VARCHAR(20) NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  address VARCHAR(255) NULL,
  neighborhood VARCHAR(100) NULL,
  notes TEXT NULL,
  subtotal_cents INT NOT NULL,
  delivery_fee_cents INT NOT NULL DEFAULT 0,
  total_cents INT NOT NULL,
  idempotency_key VARCHAR(120) NOT NULL UNIQUE,
  whatsapp_sent_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX orders_status_created_idx (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(160) NOT NULL,
  quantity INT NOT NULL,
  unit_price_cents INT NOT NULL,
  options_json LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_allowlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id VARCHAR(190) NOT NULL,
  actor_email VARCHAR(190) NOT NULL,
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120) NULL,
  metadata_json LONGTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX audit_created_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO categories (id, name, slug, sort_order, active) VALUES
  (1, 'Frangos', 'frangos', 1, 1),
  (2, 'Acompanhamentos', 'acompanhamentos', 2, 1),
  (3, 'Molhos', 'molhos', 3, 1),
  (4, 'Novidades', 'novidades', 4, 1),
  (5, 'Bebidas', 'bebidas', 5, 1);

INSERT IGNORE INTO store_settings (id, brand_name, address, opening_hours, delivery_enabled, pickup_enabled, minimum_order_cents, default_delivery_fee_cents, theme, appearance_json) VALUES
  (1, 'Crazy Chicken', 'Rua 7 de Setembro, 247 · Suzano', '18h às 23h', 1, 1, 0, 0, 'cartaz-amarelo', '{"heroTitle":"Hoje é dia de frango!","heroDescription":"Seu balde favorito, crocante e quentinho, está a um clique.","accent":"#ffc21b","primary":"#e32120","background":"#fff8e9","fontScale":"normal","density":"comfortable","visibleSections":["destaques","bebidas","cardapio","sobre"]}');

INSERT IGNORE INTO products (id, category_id, name, description, price_cents, image_key, badge, available, featured, sort_order) VALUES
  (1, 1, 'Balde 500 g', 'Frango crocante, sequinho e cheio de sabor.', 4999, 'hero-food.jpeg', 'Mais pedido', 1, 1, 1),
  (2, 1, 'Balde 1.000 g', 'Para dividir com a galera. Acompanha 2 molhos.', 6999, 'menu-cover.jpeg', 'Favorito', 1, 1, 2),
  (3, 1, 'Balde 1.500 g', 'O grandão para matar a fome de todo mundo.', 11999, 'hero-food.jpeg', NULL, 1, 0, 3),
  (4, 2, 'Anéis de cebola', 'Crocantes por fora, macios por dentro.', 3999, 'hero-food.jpeg', 'Crocante', 1, 0, 4),
  (5, 4, 'Mix de petiscos', 'Coxinha, bolinho de queijo e calabresa.', 4290, 'mix-petiscos.jpeg', 'Novidade', 1, 1, 5),
  (6, 2, 'Batata cheddar & bacon', 'Batata dourada, cheddar cremoso e bacon crocante.', 3490, 'hero-food.jpeg', NULL, 1, 0, 6),
  (7, 3, 'Molho da casa', 'Maionese temperada Crazy Chicken.', 499, 'hero-food.jpeg', NULL, 1, 0, 7),
  (8, 4, 'Mini churros', 'Doce, quentinho e perfeito para fechar.', 1999, 'mix-petiscos.jpeg', NULL, 1, 0, 8),
  (9, 5, 'Caipirinha gourmet', 'Limão, morango, maracujá ou kiwi. Feita na hora.', 4499, 'drinks-menu.jpeg', 'Destaque da casa', 1, 1, 9),
  (10, 5, 'Heineken 600 ml', 'Cerveja long neck gelada para acompanhar seu balde.', 1800, 'drinks-menu.jpeg', NULL, 1, 0, 10),
  (11, 5, 'Gin tônica copão', 'Gin, tônica e muito gelo no copão Crazy.', 4000, 'drinks-menu.jpeg', 'Drink', 1, 0, 11),
  (12, 5, 'Refrigerante lata', 'Coca-Cola, Fanta ou Sprite, 350 ml.', 700, 'drinks-menu.jpeg', NULL, 1, 0, 12);

INSERT IGNORE INTO product_options (id, product_id, group_name, label, price_delta_cents, required, active, sort_order) VALUES
  (1, 9, 'Sabor', 'Limão', 0, 1, 1, 1),
  (2, 9, 'Sabor', 'Morango', 0, 1, 1, 2),
  (3, 9, 'Sabor', 'Maracujá', 0, 1, 1, 3),
  (4, 9, 'Sabor', 'Kiwi', 0, 1, 1, 4);
