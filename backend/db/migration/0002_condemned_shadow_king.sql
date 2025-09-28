CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fname` varchar(100),
	`lname` varchar(100),
	`email` varchar(255),
	`tel` varchar(50),
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fname` varchar(100),
	`lname` varchar(100),
	`username` varchar(100),
	`status` varchar(50),
	`tel` varchar(50),
	`role` varchar(50),
	`email` varchar(255),
	`password` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employee_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employee_id` int NOT NULL,
	`action_name` varchar(100),
	`detail` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`product_id` int NOT NULL,
	`quantity` int,
	`unit_price` decimal(10,2),
	`total_price` decimal(10,2),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sale_id` int,
	`order_number` varchar(100),
	`customer_id` int NOT NULL,
	`order_date` timestamp DEFAULT (now()),
	`total_amount` decimal(10,2),
	`status` varchar(50),
	`note` text,
	`bill` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`image` varchar(255),
	`name` varchar(255) NOT NULL,
	`description` text,
	`category_id` int,
	`unit` int,
	`cost` float,
	`sell` float,
	`profit` float,
	`quantity` int,
	`quantity_pending` int,
	`company` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_in` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`quantity` int,
	`received_date` timestamp,
	`supplier_id` int,
	`status` varchar(50),
	`note` text,
	CONSTRAINT `stock_in_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_name` varchar(255) NOT NULL,
	`email` varchar(255),
	`tel` varchar(50),
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `storestock`;