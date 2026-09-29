CREATE SCHEMA "our_kitchen";
--> statement-breakpoint
CREATE TABLE "our_kitchen"."state" (
	"body" jsonb NOT NULL,
	"id" integer PRIMARY KEY NOT NULL,
	"version" integer NOT NULL
);
