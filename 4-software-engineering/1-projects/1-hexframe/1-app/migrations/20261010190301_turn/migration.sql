CREATE TABLE "turn" (
	"id" text PRIMARY KEY,
	"conversation_id" text NOT NULL,
	"message_id" text NOT NULL,
	"location" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"spent" integer DEFAULT 0 NOT NULL,
	"ended_at" timestamp with time zone,
	"end" text,
	CONSTRAINT "turn_end_check" CHECK (("ended_at" is null) = ("end" is null))
);
--> statement-breakpoint
CREATE TABLE "turn_key" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"turn_id" text NOT NULL UNIQUE,
	"hash" text NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "turn_running_idx" ON "turn" ("conversation_id") WHERE ("ended_at" is null);--> statement-breakpoint
CREATE INDEX "turn_key_accountId_idx" ON "turn_key" ("account_id");--> statement-breakpoint
ALTER TABLE "turn" ADD CONSTRAINT "turn_conversation_id_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "turn" ADD CONSTRAINT "turn_message_id_conversation_entry_id_fkey" FOREIGN KEY ("message_id") REFERENCES "conversation_entry"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "turn_key" ADD CONSTRAINT "turn_key_account_id_user_id_fkey" FOREIGN KEY ("account_id") REFERENCES "user"("id") ON DELETE CASCADE;