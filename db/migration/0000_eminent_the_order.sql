CREATE TABLE `categories` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `uidx_categories_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`fname` varchar(100),
	`lname` varchar(100),
	`email` varchar(255),
	`tel` varchar(50),
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`fname` varchar(100),
	`lname` varchar(100),
	`username` varchar(100) NOT NULL,
	`employee_status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`tel` varchar(50),
	`role` enum('owner','warehouse','sale') DEFAULT 'sale',
	`email` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime,
	CONSTRAINT `employee_id` PRIMARY KEY(`id`),
	CONSTRAINT `uidx_employee_email` UNIQUE(`email`),
	CONSTRAINT `uidx_employee_username` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`order_id` int unsigned NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`quantity` int unsigned NOT NULL DEFAULT 1,
	`unit_price` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total_price` decimal(12,2) NOT NULL DEFAULT '0.00',
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `uidx_order_items_order_product` UNIQUE(`order_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`sale_id` int unsigned,
	`order_number` varchar(100) NOT NULL,
	`customer_id` int unsigned NOT NULL,
	`order_date` datetime DEFAULT CURRENT_TIMESTAMP,
	`total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`order_status` enum('completed','canceled') NOT NULL DEFAULT 'completed',
	`note` text,
	`bill` varchar(255),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `uidx_orders_order_number` UNIQUE(`order_number`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` varchar(36) NOT NULL,
	`image` varchar(255),
	`name` varchar(255) NOT NULL,
	`description` text,
	`category_id` int unsigned,
	`unit` varchar(255),
	`cost` decimal(10,2) NOT NULL DEFAULT '0.00',
	`sell` decimal(10,2) NOT NULL DEFAULT '0.00',
	`profit` decimal(10,2) GENERATED ALWAYS AS ((sell - cost)) STORED,
	`quantity` int unsigned NOT NULL DEFAULT 0,
	`counted_qty` int unsigned NOT NULL DEFAULT 0,
	`last_counted_at` datetime,
	`count_note` text,
	`quantity_pending` int unsigned NOT NULL DEFAULT 0,
	`company` varchar(255),
	`product_status` enum('active','low_stock','restock_pending','pricing_pending') NOT NULL DEFAULT 'active',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_in` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`batch_id` int unsigned NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`quantity` int unsigned NOT NULL DEFAULT 0,
	`received_qty` int unsigned NOT NULL DEFAULT 0,
	`unit_cost` decimal(10,2) NOT NULL DEFAULT '0.00',
	`received_date` datetime,
	`supplier_id` int unsigned,
	`stock_in_status` enum('pending','some_received','completed','canceled') NOT NULL DEFAULT 'pending',
	`note` text,
	CONSTRAINT `stock_in_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_in_batches` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`supplier_id` int unsigned,
	`expected_date` datetime,
	`batch_status` enum('pending','some_received','completed','canceled') NOT NULL DEFAULT 'pending',
	`note` text,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime,
	CONSTRAINT `stock_in_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`company_name` varchar(255) NOT NULL,
	`email` varchar(255),
	`tel` varchar(50),
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_sale_id_employee_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `employee`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `stock_in` ADD CONSTRAINT `stock_in_batch_id_stock_in_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `stock_in_batches`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `stock_in` ADD CONSTRAINT `stock_in_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `stock_in` ADD CONSTRAINT `stock_in_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `stock_in_batches` ADD CONSTRAINT `stock_in_batches_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `idx_customers_email` ON `customers` (`email`);--> statement-breakpoint
CREATE INDEX `idx_customers_tel` ON `customers` (`tel`);--> statement-breakpoint
CREATE INDEX `idx_order_items_product` ON `order_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_customer` ON `orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_sale` ON `orders` (`sale_id`);--> statement-breakpoint
CREATE INDEX `idx_products_category` ON `products` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_products_name` ON `products` (`name`);--> statement-breakpoint
CREATE INDEX `idx_products_counted_at` ON `products` (`last_counted_at`);--> statement-breakpoint
CREATE INDEX `idx_stockin_batch` ON `stock_in` (`batch_id`);--> statement-breakpoint
CREATE INDEX `idx_stockin_product` ON `stock_in` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_stockin_supplier` ON `stock_in` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `idx_stockin_batches_supplier` ON `stock_in_batches` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `idx_stockin_batches_status` ON `stock_in_batches` (`batch_status`);--> statement-breakpoint
CREATE INDEX `idx_suppliers_company` ON `suppliers` (`company_name`);