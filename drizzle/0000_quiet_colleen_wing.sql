CREATE SCHEMA "our_kitchen";
--> statement-breakpoint
CREATE TABLE "our_kitchen"."attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "our_kitchen"."cache" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "our_kitchen"."state" (
	"id" integer PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"body" jsonb NOT NULL
);
