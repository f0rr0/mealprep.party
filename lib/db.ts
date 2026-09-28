import { createHash } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../env";
import type { State } from "./model";
import { kitchenState, cache, attempts } from "./schema";

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
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function readState(): Promise<State> {
  const [row] = await db
    .select()
    .from(kitchenState)
    .where(eq(kitchenState.id, 1));
  if (!row) {
    throw new Error("Kitchen state is missing.");
  }
  return {
    ...row.body,
    groceries: row.body.groceries ?? [],
    version: row.version,
  };
}
export function updateState(
  version: number,
  edit: (state: State) => void
): Promise<State> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(kitchenState)
      .where(eq(kitchenState.id, 1))
      .for("update");
    if (!row || row.version !== version) {
      throw new Error("CONFLICT");
    }
    const state = {
      ...row.body,
      groceries: row.body.groceries ?? [],
      version: row.version,
    };
    edit(state);
    state.version += 1;
    await tx
      .update(kitchenState)
      .set({ body: state, version: state.version })
      .where(eq(kitchenState.id, 1));
    return state;
  });
}
export async function getCache(key: string) {
  const [row] = await db
    .select({ value: cache.value })
    .from(cache)
    .where(eq(cache.key, key));
  return row?.value;
}
export async function setCache(key: string, value: string) {
  await db
    .insert(cache)
    .values({ key, value })
    .onConflictDoUpdate({
      set: { updatedAt: new Date(), value },
      target: cache.key,
    });
}
export async function rateLimit(key: string, limit = 10) {
  const [row] = await db
    .insert(attempts)
    .values({ count: 1, expires: new Date(Date.now() + 900_000), key })
    .onConflictDoUpdate({
      set: {
        count: sql`CASE WHEN ${attempts.expires}<now() THEN 1 ELSE ${attempts.count}+1 END`,
        expires: sql`CASE WHEN ${attempts.expires}<now() THEN now()+interval '15 minutes' ELSE ${attempts.expires} END`,
      },
      target: attempts.key,
    })
    .returning();
  return row.count <= limit;
}
export function serialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  // Transaction-scoped database lock also serializes cart changes across Vercel workers.
  return db.transaction(async (tx) => {
    const [lock] = await tx.execute(
      sql`select pg_try_advisory_xact_lock(hashtext(${key})) as acquired`
    );
    if (!lock.acquired) {
      throw new Error("This account is busy. Please try again shortly.");
    }
    return fn();
  });
}
