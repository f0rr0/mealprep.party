import { test } from "bun:test";
import assert from "node:assert/strict";

import meals from "../content/meals.json";
import schedule from "../content/plan.json";
import { parsePlan } from "../scripts/plan";

test("compact schedules expand member defaults and validate meal and member references", () => {
  const plan = parsePlan(schedule, meals);
  assert.equal(plan.plan.length, 28);
  assert.deepEqual(plan.plan[0].people, schedule.week.Monday.Breakfast.members);
  assert.deepEqual(plan.plan[1].people, Object.keys(schedule.members));
  assert.equal(plan.meals[0].recipeLink, "");
  for (const entry of [
    "unknown-meal",
    { meal: meals[0].id, members: ["unknown-member"] },
  ]) {
    assert.throws(() =>
      parsePlan(
        {
          ...schedule,
          week: {
            ...schedule.week,
            Monday: { ...schedule.week.Monday, Lunch: entry },
          },
        },
        meals
      )
    );
  }
});
