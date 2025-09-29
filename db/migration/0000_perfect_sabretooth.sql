CREATE TABLE `storestock` (
	`id` char(36) NOT NULL,
	`img_url` varchar(2048),
	`title` varchar(255) NOT NULL,
	`category` varchar(255) NOT NULL,
	`amount` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `storestock_id` PRIMARY KEY(`id`)
);
