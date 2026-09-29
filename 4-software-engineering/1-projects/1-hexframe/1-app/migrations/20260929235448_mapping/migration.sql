CREATE TABLE "tile" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"parent_id" text,
	"direction" smallint,
	"title" text NOT NULL,
	"preview" text NOT NULL,
	"body" text NOT NULL,
	"target" text
);
--> statement-breakpoint
CREATE INDEX "tile_accountId_idx" ON "tile" ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tile_root_idx" ON "tile" ("account_id") WHERE ("parent_id" is null);--> statement-breakpoint
CREATE UNIQUE INDEX "tile_slot_idx" ON "tile" ("parent_id","direction");--> statement-breakpoint
ALTER TABLE "tile" ADD CONSTRAINT "tile_parent_id_tile_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "tile"("id") ON DELETE CASCADE;