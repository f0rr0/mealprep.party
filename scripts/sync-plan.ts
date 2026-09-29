import { db, readState, updateState } from "@/lib/db";
import { updateGroceries } from "@/lib/model";

import { parsePlan } from "./plan";

const content = parsePlan(
  await Bun.file(Bun.argv[2] ?? "content/plan.json").json(),
  await Bun.file(Bun.argv[3] ?? "content/meals.json").json(),
  await Bun.file(Bun.argv[4] ?? "content/members.json").json()
);
try {
  const current = await readState();
  await updateState(current.version, (state) => {
    state.names = content.names;
    state.avatars = content.avatars;
    state.meals = content.meals;
    state.plan = content.plan;
    state.groceries = updateGroceries(state, [], []);
  });
  console.log(
    `Saved ${content.meals.length} meals and ${content.plan.length} weekday entries.`
  );
} finally {
  await db.$client.end();
}
