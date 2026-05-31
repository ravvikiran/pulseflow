CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`category` enum('breakout','volume_spike','ema_crossover','sector_momentum','pattern_detected','system','alert_triggered') NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`symbol` varchar(30),
	`sector` varchar(100),
	`marketDomain` enum('india','crypto','us','global') NOT NULL DEFAULT 'global',
	`metadata` json,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_notif_user_read` ON `notifications` (`userId`,`isRead`);--> statement-breakpoint
CREATE INDEX `idx_notif_user_time` ON `notifications` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_notif_category` ON `notifications` (`category`);