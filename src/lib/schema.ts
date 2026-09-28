import { pgSchema, integer, jsonb, text, timestamp } from "drizzle-orm/pg-core";

import type { State } from "./model";

export const kitchenSchema = pgSchema("our_kitchen");
export const kitchenState = kitchenSchema.table("state", {
  body: jsonb().$type<State>().notNull(),
  id: integer().primaryKey(),
  version: integer().notNull(),
});
export const cache = kitchenSchema.table("cache", {
  key: text().primaryKey(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  value: text().notNull(),
});
export const attempts = kitchenSchema.table("attempts", {
  count: integer().notNull(),
  expires: timestamp({ withTimezone: true }).notNull(),
  key: text().primaryKey(),
});
