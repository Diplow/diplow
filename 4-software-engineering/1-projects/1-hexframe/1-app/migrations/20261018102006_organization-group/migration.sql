CREATE TABLE "group_member" (
	"group_id" text,
	"organization_id" text NOT NULL,
	"account_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_member_pkey" PRIMARY KEY("group_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "organization_group" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_group_name_unique" UNIQUE("organization_id","name"),
	CONSTRAINT "organization_group_of_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE INDEX "group_member_accountId_idx" ON "group_member" ("account_id");--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_group_fkey" FOREIGN KEY ("group_id","organization_id") REFERENCES "organization_group"("id","organization_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_membership_fkey" FOREIGN KEY ("organization_id","account_id") REFERENCES "membership"("organization_id","account_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_group" ADD CONSTRAINT "organization_group_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;