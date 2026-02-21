CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walletAddress` varchar(42) NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'New Conversation',
	`messages` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastPlatform` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walletAddress` varchar(42) NOT NULL,
	`content` text NOT NULL,
	`category` varchar(50) DEFAULT 'general',
	`sourceConversationId` int,
	`sourcePlatform` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wallet_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walletAddress` varchar(42) NOT NULL,
	`displayName` varchar(100),
	`lastPlatform` varchar(20),
	`lastSeen` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallet_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `wallet_profiles_walletAddress_unique` UNIQUE(`walletAddress`)
);
--> statement-breakpoint
CREATE TABLE `wallet_sync_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walletAddress` varchar(42) NOT NULL,
	`preferences` json,
	`cachedBalances` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallet_sync_data_id` PRIMARY KEY(`id`),
	CONSTRAINT `wallet_sync_data_walletAddress_unique` UNIQUE(`walletAddress`)
);
