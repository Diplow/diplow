CREATE TABLE "proposal" (
	"id" text PRIMARY KEY,
	"conversation_id" text NOT NULL,
	"entry_id" text NOT NULL,
	"turn_id" text NOT NULL,
	"drafts" jsonb NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"fate" text,
	CONSTRAINT "proposal_fate_check" CHECK (("decided_at" is null) = ("fate" is null))
);
--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "mode" text DEFAULT 'ask' NOT NULL;--> statement-breakpoint
ALTER TABLE "turn" ADD COLUMN "mode" text DEFAULT 'apply' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_open_idx" ON "proposal" ("conversation_id") WHERE ("decided_at" is null);--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_conversation_id_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_entry_id_conversation_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "conversation_entry"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_turn_id_turn_id_fkey" FOREIGN KEY ("turn_id") REFERENCES "turn"("id") ON DELETE CASCADE;