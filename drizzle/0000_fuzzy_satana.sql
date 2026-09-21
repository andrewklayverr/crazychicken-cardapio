CREATE TABLE `admin_allowlist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_allowlist_email_unique` ON `admin_allowlist` (`email`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_user_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `delivery_zones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`fee_cents` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`product_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`options_json` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`fulfillment_type` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`address` text,
	`neighborhood` text,
	`notes` text,
	`subtotal_cents` integer NOT NULL,
	`delivery_fee_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`whatsapp_sent_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_code_unique` ON `orders` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_idempotency_key_unique` ON `orders` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `product_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`group_name` text NOT NULL,
	`label` text NOT NULL,
	`price_delta_cents` integer DEFAULT 0 NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price_cents` integer NOT NULL,
	`image_key` text,
	`badge` text,
	`available` integer DEFAULT true NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `store_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`brand_name` text DEFAULT 'Crazy Chicken' NOT NULL,
	`logo_key` text,
	`whatsapp_number` text,
	`address` text DEFAULT 'Rua 7 de Setembro, 247 · Suzano' NOT NULL,
	`opening_hours` text DEFAULT '18h às 23h' NOT NULL,
	`delivery_enabled` integer DEFAULT true NOT NULL,
	`pickup_enabled` integer DEFAULT true NOT NULL,
	`minimum_order_cents` integer DEFAULT 0 NOT NULL,
	`default_delivery_fee_cents` integer DEFAULT 0 NOT NULL,
	`theme` text DEFAULT 'cartaz-amarelo' NOT NULL,
	`appearance_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
INSERT INTO `categories` (`id`, `name`, `slug`, `sort_order`, `active`) VALUES
(1, 'Frangos', 'frangos', 1, 1),
(2, 'Acompanhamentos', 'acompanhamentos', 2, 1),
(3, 'Molhos', 'molhos', 3, 1),
(4, 'Novidades', 'novidades', 4, 1),
(5, 'Bebidas', 'bebidas', 5, 1);
--> statement-breakpoint
INSERT INTO `store_settings` (`id`, `brand_name`, `address`, `opening_hours`, `delivery_enabled`, `pickup_enabled`, `minimum_order_cents`, `default_delivery_fee_cents`, `theme`, `appearance_json`) VALUES
(1, 'Crazy Chicken', 'Rua 7 de Setembro, 247 · Suzano', '18h às 23h', 1, 1, 0, 0, 'cartaz-amarelo', '{"heroTitle":"Hoje é dia de frango!","heroDescription":"Seu balde favorito, crocante e quentinho, está a um clique.","accent":"#ffc21b","primary":"#e32120","background":"#fff8e9","fontScale":"normal","density":"comfortable","visibleSections":["destaques","bebidas","cardapio","sobre"]}');
--> statement-breakpoint
INSERT INTO `products` (`id`, `category_id`, `name`, `description`, `price_cents`, `image_key`, `badge`, `available`, `featured`, `sort_order`) VALUES
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
--> statement-breakpoint
INSERT INTO `product_options` (`id`, `product_id`, `group_name`, `label`, `price_delta_cents`, `required`, `active`, `sort_order`) VALUES
(1, 9, 'Sabor', 'Limão', 0, 1, 1, 1),
(2, 9, 'Sabor', 'Morango', 0, 1, 1, 2),
(3, 9, 'Sabor', 'Maracujá', 0, 1, 1, 3),
(4, 9, 'Sabor', 'Kiwi', 0, 1, 1, 4);
