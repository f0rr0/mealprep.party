import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { updateGroceries } from "@/lib/model";
import { kitchenState } from "@/lib/schema";

import { parsePlan } from "./plan";

const content = parsePlan(
  await Bun.file(Bun.argv[2] ?? "content/plan.json").json(),
  await Bun.file(Bun.argv[3] ?? "content/meals.json").json(),
  await Bun.file(Bun.argv[4] ?? "content/members.json").json()
);
try {
  await db.transaction(async (tx) => {
    await tx
      .insert(kitchenState)
      .values({
        id: 1,
        version: 0,
        body: { ...content, groceries: [], pantry: [], version: 0 },
      })
      .onConflictDoNothing();
    const [current] = await tx
      .select()
      .from(kitchenState)
      .where(eq(kitchenState.id, 1))
      .for("update");
    const state = { ...current.body, ...content, version: current.version + 1 };
    state.groceries = updateGroceries(state, [], []);
    await tx
      .update(kitchenState)
      .set({ body: state, version: state.version })
      .where(eq(kitchenState.id, 1));
  });
  console.log(
    `Saved ${content.meals.length} meals and ${content.plan.length} weekday entries.`
  );
} finally {
  await db.$client.end();
}
