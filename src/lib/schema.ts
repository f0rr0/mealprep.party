import { pgSchema, integer, jsonb } from "drizzle-orm/pg-core";

import type { State } from "./model";

export const kitchenSchema = pgSchema("meal_prep_party");
export const kitchenState = kitchenSchema.table("state", {
  body: jsonb().$type<State>().notNull(),
  id: integer().primaryKey(),
  version: integer().notNull(),
});
