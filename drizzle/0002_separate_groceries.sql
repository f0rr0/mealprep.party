CREATE TABLE "meal_prep_party"."grocery_items" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"position" integer GENERATED ALWAYS AS IDENTITY (sequence name "meal_prep_party"."grocery_items_position_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1)
);
--> statement-breakpoint
CREATE TABLE "meal_prep_party"."revision" (
	"id" integer PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "singleton" CHECK ("meal_prep_party"."revision"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "meal_prep_party"."meals" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"recipe" text NOT NULL,
	"ingredients" text[] NOT NULL,
	"recipe_link" text DEFAULT '' NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_prep_party"."members" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"avatar" text
);
--> statement-breakpoint
CREATE TABLE "meal_prep_party"."plan_entries" (
	"day" text NOT NULL,
	"slot" text NOT NULL,
	"meal_id" text NOT NULL,
	"people" text[] NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "plan_entries_day_slot_meal_id_pk" PRIMARY KEY("day","slot","meal_id")
);
--> statement-breakpoint
ALTER TABLE "meal_prep_party"."plan_entries" ADD CONSTRAINT "plan_entries_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "meal_prep_party"."meals"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Copy content and the current list before removing the old JSON document.
INSERT INTO "meal_prep_party"."revision" ("id", "version")
SELECT "id", "version" FROM "meal_prep_party"."state";
--> statement-breakpoint
INSERT INTO "meal_prep_party"."members" ("id", "name", "avatar")
SELECT member.key, member.value, state.body->'avatars'->>member.key
FROM "meal_prep_party"."state" state,
LATERAL jsonb_each_text(state.body->'names') member;
--> statement-breakpoint
INSERT INTO "meal_prep_party"."meals" ("id", "title", "recipe", "ingredients", "recipe_link", "position")
SELECT meal->>'id', meal->>'title', meal->>'recipe',
ARRAY(SELECT jsonb_array_elements_text(meal->'ingredients')),
coalesce(meal->>'recipeLink', ''), ordinal - 1
FROM "meal_prep_party"."state" state,
LATERAL jsonb_array_elements(state.body->'meals') WITH ORDINALITY AS catalog(meal, ordinal);
--> statement-breakpoint
INSERT INTO "meal_prep_party"."plan_entries" ("day", "slot", "meal_id", "people", "position")
SELECT entry->>'day', entry->>'slot', entry->>'mealId',
ARRAY(SELECT jsonb_array_elements_text(entry->'people')), ordinal - 1
FROM "meal_prep_party"."state" state,
LATERAL jsonb_array_elements(state.body->'plan') WITH ORDINALITY AS plan(entry, ordinal);
--> statement-breakpoint
WITH ingredients AS (
  SELECT lower(btrim(ingredient.name)) AS key, btrim(ingredient.name) AS name,
    coalesce(state.body->'pantry', '[]'::jsonb) ? lower(btrim(ingredient.name)) AS checked,
    meal.ordinal * 1000 + ingredient.ordinal AS position
  FROM "meal_prep_party"."state" state,
  LATERAL jsonb_array_elements(state.body->'meals') WITH ORDINALITY AS meal(value, ordinal),
  LATERAL jsonb_array_elements_text(meal.value->'ingredients') WITH ORDINALITY AS ingredient(name, ordinal)
  WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(state.body->'plan') entry
    WHERE entry->>'mealId' = meal.value->>'id'
      AND coalesce(state.body->'groceries', '[]'::jsonb) ?
        ((entry->>'day') || ':' || (entry->>'slot') || ':' || (entry->>'mealId'))
  )
)
INSERT INTO "meal_prep_party"."grocery_items" ("key", "name", "checked")
SELECT key, (array_agg(name ORDER BY position DESC))[1], bool_or(checked)
FROM ingredients GROUP BY key ORDER BY min(position);
--> statement-breakpoint
DROP TABLE "meal_prep_party"."state";
