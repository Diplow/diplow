CREATE TABLE "applied" (
	"id" text PRIMARY KEY,
	"conversation_id" text NOT NULL,
	"entry_id" text,
	"undo" jsonb NOT NULL,
	"changes" integer DEFAULT 0 NOT NULL,
	"undone_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "applied" ADD CONSTRAINT "applied_conversation_id_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "applied" ADD CONSTRAINT "applied_entry_id_conversation_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "conversation_entry"("id") ON DELETE CASCADE;