import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  check,
  integer,
  pgSchema,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";

import { slots, weekdays } from "./model";

export const kitchenSchema = pgSchema("meal_prep_party");
export const pushSubscriptions = kitchenSchema.table("push_subscriptions", {
  endpoint: text().primaryKey(),
  p256dh: text().notNull(),
  auth: text().notNull(),
  lastSentDay: date("last_sent_day"),
});
export const members = kitchenSchema.table("members", {
  id: text().primaryKey(),
  name: text().notNull(),
  avatar: text(),
});
export const meals = kitchenSchema.table("meals", {
  id: text().primaryKey(),
  title: text().notNull(),
  recipe: text().notNull(),
  ingredients: text().array().notNull(),
  recipeLink: text("recipe_link").notNull().default(""),
  position: integer().notNull(),
});
export const planEntries = kitchenSchema.table(
  "plan_entries",
  {
    day: text({ enum: weekdays }).notNull(),
    slot: text({ enum: slots }).notNull(),
    mealId: text("meal_id")
      .notNull()
      .references(() => meals.id),
    people: text().array().notNull(),
    position: integer().notNull(),
  },
  (table) => [primaryKey({ columns: [table.day, table.slot, table.mealId] })]
);
export const groceryItems = kitchenSchema.table("grocery_items", {
  key: text().primaryKey(),
  name: text().notNull(),
  checked: boolean().notNull().default(false),
  position: integer().generatedAlwaysAsIdentity(),
});
// One revision coordinates optimistic writes and content sync, without copying content.
export const kitchenRevision = kitchenSchema.table(
  "revision",
  {
    id: integer().primaryKey(),
    version: integer().notNull(),
  },
  (table) => [check("singleton", sql`${table.id} = 1`)]
);
