import { test } from "bun:test";
import assert from "node:assert/strict";

import { planSchema, withNames } from "@/lib/model";
import { mealShareText } from "@/lib/share";

import { createState } from "./fixtures";

test("members support arbitrary IDs and household sizes without dangling references", () => {
  const state = createState();
  state.names = { alex: "Alex", "member-b": "Ria", cook: "Sam" };
  state.plan = [{ ...state.plan[0], people: Object.keys(state.names) }];
  const plan = { names: state.names, meals: state.meals, plan: state.plan };
  assert.ok(planSchema.safeParse(plan).success);
  assert.ok(mealShareText(state, state.plan).includes("Alex & Ria & Sam"));
  assert.equal(
    withNames(
      "{{alex}} / {{cook}} / {{missing}} / {{constructor}}",
      state.names
    ),
    "Alex / Sam / {{missing}} / {{constructor}}"
  );
  for (const people of [["unknown"], ["alex", "alex"], []]) {
    assert.equal(
      planSchema.safeParse({ ...plan, plan: [{ ...state.plan[0], people }] })
        .success,
      false
    );
  }
  assert.equal(planSchema.safeParse({ ...plan, names: {} }).success, false);
  assert.equal(
    planSchema.safeParse({ ...plan, names: { constructor: "Invalid" } })
      .success,
    false
  );
});
