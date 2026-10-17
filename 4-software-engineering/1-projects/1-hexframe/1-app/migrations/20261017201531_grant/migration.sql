CREATE TABLE "grant" (
	"tile_id" text NOT NULL,
	"subject" text NOT NULL,
	"subject_id" text,
	"value" text NOT NULL,
	CONSTRAINT "grant_subject_unique" UNIQUE NULLS NOT DISTINCT("tile_id","subject","subject_id"),
	CONSTRAINT "grant_subject_check" CHECK ("subject" in ('account', 'group', 'everyone')),
	CONSTRAINT "grant_value_check" CHECK ("value" in ('none', 'read', 'read+write', 'read+@', 'read+write+@')),
	CONSTRAINT "grant_everyone_id_check" CHECK ((("subject" <> 'everyone') or (("subject_id" is null)))),
	CONSTRAINT "grant_named_id_check" CHECK ((("subject" = 'everyone') or (("subject_id" is not null)))),
	CONSTRAINT "grant_everyone_check" CHECK ((("subject" <> 'everyone') or ("value" in ('none', 'read'))))
);
--> statement-breakpoint
ALTER TABLE "grant" ADD CONSTRAINT "grant_tile_id_tile_id_fkey" FOREIGN KEY ("tile_id") REFERENCES "tile"("id") ON DELETE CASCADE;