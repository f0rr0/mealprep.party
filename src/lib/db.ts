import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { z } from "zod";

import { env } from "../env";
import { ingredientKey, updateGroceries } from "./model";
import type { kitchenCommand, Plan, State } from "./model";
import {
  groceryItems,
  kitchenRevision,
  meals,
  members,
  planEntries,
} from "./schema";

const globalDb = globalThis as unknown as {
  kitchenSQL?: ReturnType<typeof postgres>;
};
const client =
  globalDb.kitchenSQL ??
  postgres(env.DATABASE_URL, {
    connect_timeout: 10,
    idle_timeout: 20,
    max: 5,
    prepare: false,
    ssl: "require",
  });
globalDb.kitchenSQL = client;
export const db = drizzle(client);

const groceryFields = {
  version: kitchenRevision.version,
  groceries: sql<
    string[]
  >`(select coalesce(jsonb_agg(${groceryItems.name} order by ${groceryItems.position}), '[]'::jsonb) from ${groceryItems})`,
  pantry: sql<
    string[]
  >`(select coalesce(jsonb_agg(${groceryItems.key} order by ${groceryItems.position}) filter (where ${groceryItems.checked}), '[]'::jsonb) from ${groceryItems})`,
};

// Scalar subqueries give one network round trip and one consistent database snapshot.
export async function readState(): Promise<State> {
  const [state] = await db
    .select({
      ...groceryFields,
      names: sql<
        State["names"]
      >`(select coalesce(jsonb_object_agg(${members.id}, ${members.name}), '{}'::jsonb) from ${members})`,
      avatars: sql<
        State["avatars"]
      >`(select coalesce(jsonb_object_agg(${members.id}, ${members.avatar}) filter (where ${members.avatar} is not null), '{}'::jsonb) from ${members})`,
      meals: sql<
        State["meals"]
      >`(select coalesce(jsonb_agg(jsonb_build_object('id', ${meals.id}, 'title', ${meals.title}, 'recipe', ${meals.recipe}, 'ingredients', ${meals.ingredients}, 'recipeLink', ${meals.recipeLink}) order by ${meals.position}), '[]'::jsonb) from ${meals})`,
      plan: sql<
        State["plan"]
      >`(select coalesce(jsonb_agg(jsonb_build_object('day', ${planEntries.day}, 'slot', ${planEntries.slot}, 'mealId', ${planEntries.mealId}, 'people', ${planEntries.people}) order by ${planEntries.position}), '[]'::jsonb) from ${planEntries})`,
    })
    .from(kitchenRevision)
    .where(eq(kitchenRevision.id, 1));
  if (!state) {
    throw new Error("Kitchen state is missing.");
  }
  return state;
}

export function updateKitchen(command: z.infer<typeof kitchenCommand>) {
  return db.transaction(async (tx) => {
    const [revision] = await tx
      .update(kitchenRevision)
      .set({ version: sql`${kitchenRevision.version} + 1` })
      .where(
        and(
          eq(kitchenRevision.id, 1),
          eq(kitchenRevision.version, command.version)
        )
      )
      .returning({ version: kitchenRevision.version });
    if (!revision) {
      throw new Error("CONFLICT");
    }
    if (command.action === "pantry") {
      await tx
        .update(groceryItems)
        .set({ checked: command.checked })
        .where(eq(groceryItems.key, ingredientKey(command.ingredient)));
    } else {
      if (command.remove.length) {
        await tx
          .delete(groceryItems)
          .where(inArray(groceryItems.key, command.remove.map(ingredientKey)));
      }
      if (command.add.length) {
        const names = updateGroceries({ groceries: [] }, command.add, []);
        await tx
          .insert(groceryItems)
          .values(names.map((name) => ({ key: ingredientKey(name), name })))
          .onConflictDoNothing({ target: groceryItems.key });
      }
    }
    const [state] = await tx
      .select(groceryFields)
      .from(kitchenRevision)
      .where(eq(kitchenRevision.id, 1));
    return state;
  });
}

export function syncPlan(content: Plan) {
  return db.transaction(async (tx) => {
    await tx
      .insert(kitchenRevision)
      .values({ id: 1, version: 1 })
      .onConflictDoUpdate({
        target: kitchenRevision.id,
        set: { version: sql`${kitchenRevision.version} + 1` },
      });
    await tx.delete(planEntries);
    await tx.delete(meals);
    await tx.delete(members);
    await tx.insert(members).values(
      Object.entries(content.names).map(([id, name]) => ({
        id,
        name,
        avatar: content.avatars?.[id],
      }))
    );
    if (content.meals.length) {
      await tx
        .insert(meals)
        .values(content.meals.map((meal, position) => ({ ...meal, position })));
    }
    if (content.plan.length) {
      await tx
        .insert(planEntries)
        .values(
          content.plan.map((entry, position) => ({ ...entry, position }))
        );
    }
  });
}
