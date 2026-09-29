CREATE TABLE "meal_prep_party"."push_subscriptions" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"last_sent_day" date
);
