ALTER TABLE "tile" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "tile" ADD COLUMN "config" jsonb;--> statement-breakpoint
ALTER TABLE "tile" ADD COLUMN "frontmatter" jsonb;