CREATE TABLE "join_request" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"group_id" text,
	"account_id" text NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "join_request_state_check" CHECK ("state" in ('open', 'accepted', 'declined'))
);
--> statement-breakpoint
CREATE INDEX "join_request_organizationId_idx" ON "join_request" ("organization_id");--> statement-breakpoint
CREATE INDEX "join_request_accountId_idx" ON "join_request" ("account_id");--> statement-breakpoint
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_account_id_user_id_fkey" FOREIGN KEY ("account_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_group_fkey" FOREIGN KEY ("group_id","organization_id") REFERENCES "organization_group"("id","organization_id") ON DELETE CASCADE;