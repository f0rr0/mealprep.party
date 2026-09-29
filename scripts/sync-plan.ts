import { db, syncPlan } from "@/lib/db";

import { parsePlan } from "./plan";

try {
  const content = parsePlan(
    await Bun.file(Bun.argv[2] ?? "content/plan.json").json(),
    await Bun.file(Bun.argv[3] ?? "content/meals.json").json(),
    await Bun.file(Bun.argv[4] ?? "content/members.json").json()
  );
  await syncPlan(content);
  console.log(
    `Saved ${content.meals.length} meals and ${content.plan.length} weekday entries.`
  );
} finally {
  await db.$client.end();
}
