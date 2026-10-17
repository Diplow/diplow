ALTER TABLE "tile" RENAME COLUMN "account_id" TO "owner_id";--> statement-breakpoint
ALTER INDEX "tile_accountId_idx" RENAME TO "tile_ownerId_idx";