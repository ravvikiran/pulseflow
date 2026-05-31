CREATE TABLE `alert_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertId` int NOT NULL,
	`userId` int NOT NULL,
	`message` text NOT NULL,
	`value` decimal(20,8),
	`sentVia` enum('in_app','email','telegram') DEFAULT 'in_app',
	`isRead` boolean NOT NULL DEFAULT false,
	`triggeredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alert_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`assetId` int,
	`alertType` enum('ema_crossover','volume_spike','breakout_52w','breakout_ath','sector_momentum_shift','trend_reversal','relative_strength_change','price_target') NOT NULL,
	`condition` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`isRead` boolean NOT NULL DEFAULT false,
	`lastTriggered` timestamp,
	`triggerCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(30) NOT NULL,
	`name` varchar(255) NOT NULL,
	`assetType` enum('stock','crypto','index','sector_index') NOT NULL,
	`sector` varchar(100),
	`exchange` varchar(50),
	`currency` varchar(10) DEFAULT 'USD',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `assets_symbol_unique` UNIQUE(`symbol`)
);
--> statement-breakpoint
CREATE TABLE `favorite_sectors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sector` varchar(100) NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favorite_sectors_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_unique_fav_sector` UNIQUE(`userId`,`sector`)
);
--> statement-breakpoint
CREATE TABLE `historical_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotType` enum('sector_rotation','market_sentiment','scanner_summary') NOT NULL,
	`data` json NOT NULL,
	`timestamp` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historical_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `market_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`timeframe` varchar(10) NOT NULL,
	`open` decimal(20,8),
	`high` decimal(20,8),
	`low` decimal(20,8),
	`close` decimal(20,8),
	`volume` bigint,
	`timestamp` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `market_data_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_unique_ohlcv` UNIQUE(`assetId`,`timeframe`,`timestamp`)
);
--> statement-breakpoint
CREATE TABLE `market_sentiment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sentimentScore` decimal(5,2) NOT NULL,
	`marketState` enum('bullish','bearish','neutral') NOT NULL,
	`advanceCount` int,
	`declineCount` int,
	`unchangedCount` int,
	`advanceDeclineRatio` decimal(8,4),
	`breadthScore` decimal(5,2),
	`volatilityIndex` decimal(8,4),
	`btcDominance` decimal(5,2),
	`totalMarketCap` decimal(20,2),
	`fearGreedIndex` decimal(5,2),
	`timestamp` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `market_sentiment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saved_scans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`config` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_scans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scanner_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`timeframe` varchar(10) NOT NULL,
	`scanType` varchar(50) NOT NULL,
	`score` decimal(5,2),
	`details` json,
	`matchedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scanner_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sector_performance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sector` varchar(100) NOT NULL,
	`timeframe` varchar(10) NOT NULL,
	`performanceScore` decimal(6,2),
	`momentumScore` decimal(5,2),
	`strengthScore` decimal(5,2),
	`volumeScore` decimal(5,2),
	`breakoutFrequency` decimal(5,2),
	`inflowOutflow` decimal(10,2),
	`priceChange1d` decimal(6,2),
	`priceChange1w` decimal(6,2),
	`priceChange1m` decimal(6,2),
	`rank` int,
	`timestamp` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sector_performance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `technical_indicators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`timeframe` varchar(10) NOT NULL,
	`ema20` decimal(20,8),
	`ema50` decimal(20,8),
	`ema200` decimal(20,8),
	`rsi` decimal(5,2),
	`macd` decimal(20,8),
	`macdSignal` decimal(20,8),
	`macdHistogram` decimal(20,8),
	`volumeAvg20` bigint,
	`atr` decimal(20,8),
	`high52w` decimal(20,8),
	`low52w` decimal(20,8),
	`ath` decimal(20,8),
	`relativeStrength` decimal(5,2),
	`timestamp` timestamp NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `technical_indicators_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_unique_ti` UNIQUE(`assetId`,`timeframe`)
);
--> statement-breakpoint
CREATE TABLE `watchlist_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`watchlistId` int NOT NULL,
	`assetId` int NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	CONSTRAINT `watchlist_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_unique_watchlist_asset` UNIQUE(`watchlistId`,`assetId`)
);
--> statement-breakpoint
CREATE TABLE `watchlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`isDefault` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `watchlists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `preferences` json;--> statement-breakpoint
ALTER TABLE `alert_history` ADD CONSTRAINT `alert_history_alertId_alerts_id_fk` FOREIGN KEY (`alertId`) REFERENCES `alerts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alert_history` ADD CONSTRAINT `alert_history_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `favorite_sectors` ADD CONSTRAINT `favorite_sectors_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `market_data` ADD CONSTRAINT `market_data_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saved_scans` ADD CONSTRAINT `saved_scans_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scanner_results` ADD CONSTRAINT `scanner_results_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `technical_indicators` ADD CONSTRAINT `technical_indicators_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watchlist_items` ADD CONSTRAINT `watchlist_items_watchlistId_watchlists_id_fk` FOREIGN KEY (`watchlistId`) REFERENCES `watchlists`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watchlist_items` ADD CONSTRAINT `watchlist_items_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watchlists` ADD CONSTRAINT `watchlists_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_ah_user_read` ON `alert_history` (`userId`,`isRead`);--> statement-breakpoint
CREATE INDEX `idx_ah_alert` ON `alert_history` (`alertId`);--> statement-breakpoint
CREATE INDEX `idx_alert_user` ON `alerts` (`userId`,`isActive`);--> statement-breakpoint
CREATE INDEX `idx_alert_asset` ON `alerts` (`assetId`);--> statement-breakpoint
CREATE INDEX `idx_symbol` ON `assets` (`symbol`);--> statement-breakpoint
CREATE INDEX `idx_sector` ON `assets` (`sector`);--> statement-breakpoint
CREATE INDEX `idx_asset_type` ON `assets` (`assetType`);--> statement-breakpoint
CREATE INDEX `idx_snapshot_type_time` ON `historical_snapshots` (`snapshotType`,`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_asset_time` ON `market_data` (`assetId`,`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_timeframe` ON `market_data` (`timeframe`);--> statement-breakpoint
CREATE INDEX `idx_sentiment_time` ON `market_sentiment` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_saved_scan_user` ON `saved_scans` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_scan_type_time` ON `scanner_results` (`scanType`,`matchedAt`);--> statement-breakpoint
CREATE INDEX `idx_scan_asset` ON `scanner_results` (`assetId`,`matchedAt`);--> statement-breakpoint
CREATE INDEX `idx_sector_time` ON `sector_performance` (`sector`,`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_sector_rank` ON `sector_performance` (`rank`);--> statement-breakpoint
CREATE INDEX `idx_ti_asset_time` ON `technical_indicators` (`assetId`,`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_watchlist_user` ON `watchlists` (`userId`);