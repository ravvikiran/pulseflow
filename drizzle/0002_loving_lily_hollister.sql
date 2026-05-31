CREATE TABLE `scanner_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`config` json NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scanner_presets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`theme` enum('dark','light','system') NOT NULL DEFAULT 'dark',
	`defaultLandingPage` enum('home','india','crypto','us') NOT NULL DEFAULT 'home',
	`timezone` varchar(64) NOT NULL DEFAULT 'Asia/Kolkata',
	`currency` varchar(10) NOT NULL DEFAULT 'INR',
	`language` varchar(10) NOT NULL DEFAULT 'en',
	`defaultWatchlistId` int,
	`preferredModules` json DEFAULT ('["india","crypto"]'),
	`preferredTimeframe` varchar(10) NOT NULL DEFAULT '1d',
	`scannerRefreshInterval` int NOT NULL DEFAULT 60,
	`heatmapRefreshInterval` int NOT NULL DEFAULT 30,
	`defaultChartInterval` varchar(10) NOT NULL DEFAULT '1d',
	`alertEmail` boolean NOT NULL DEFAULT false,
	`alertEmailAddress` varchar(320),
	`alertTelegram` boolean NOT NULL DEFAULT false,
	`alertTelegramHandle` varchar(100),
	`alertInApp` boolean NOT NULL DEFAULT true,
	`alertVolumeSpike` boolean NOT NULL DEFAULT true,
	`alertEmaCrossover` boolean NOT NULL DEFAULT true,
	`alertBreakout` boolean NOT NULL DEFAULT true,
	`alertSectorMomentum` boolean NOT NULL DEFAULT true,
	`alertSensitivity` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`autoRefresh` boolean NOT NULL DEFAULT true,
	`realTimeUpdates` boolean NOT NULL DEFAULT true,
	`performanceMode` boolean NOT NULL DEFAULT false,
	`dataRetentionDays` int NOT NULL DEFAULT 90,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_preferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `scanner_presets` ADD CONSTRAINT `scanner_presets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD CONSTRAINT `user_preferences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_preset_user` ON `scanner_presets` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_user_prefs_user` ON `user_preferences` (`userId`);