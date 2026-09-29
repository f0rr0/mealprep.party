import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../env";
import type { State } from "./model";
import { kitchenState } from "./schema";

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
