import { db, readState, updateState } from "../lib/db";
import { planSchema } from "../lib/model";

const content = planSchema.parse(
  await Bun.file(Bun.argv[2] ?? "content/plan.json").json()
);
try {
  const current = await readState();
  await updateState(current.version, (state) => {
    state.meals = content.meals;
    state.plan = content.plan;
  });
  console.log(
    `Saved ${content.meals.length} meals and ${content.plan.length} weekday entries.`
  );
} finally {
  await db.$client.end();
}
