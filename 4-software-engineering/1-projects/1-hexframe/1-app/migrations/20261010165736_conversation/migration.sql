CREATE TABLE "conversation" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_entry" (
	"id" text PRIMARY KEY,
	"conversation_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "conversation_entry_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"content" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "conversation_entry_at_idx" ON "conversation_entry" ("conversation_id","at","seq");--> statement-breakpoint
ALTER TABLE "conversation_entry" ADD CONSTRAINT "conversation_entry_conversation_id_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE;