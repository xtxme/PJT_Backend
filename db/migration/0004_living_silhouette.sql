SET @existing_fk := (
	SELECT `CONSTRAINT_NAME`
	FROM `information_schema`.`TABLE_CONSTRAINTS`
	WHERE `TABLE_SCHEMA` = DATABASE()
		AND `TABLE_NAME` = 'order_items'
		AND `CONSTRAINT_TYPE` = 'FOREIGN KEY'
		AND `CONSTRAINT_NAME` = 'order_items_order_id_orders_id_fk'
	LIMIT 1
);
--> statement-breakpoint
SET @fk_sql := IF(
	@existing_fk IS NULL,
	'ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;',
	'DO 1;'
);
--> statement-breakpoint
PREPARE fk_stmt FROM @fk_sql;
--> statement-breakpoint
EXECUTE fk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE fk_stmt;
