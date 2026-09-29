import { test } from "bun:test";
import assert from "node:assert/strict";

import {
  groupPlan,
  ingredientsForEntries,
  selectEntries,
  updateGroceries,
} from "@/lib/model";
import { mealShareText } from "@/lib/share";

import { parsePlan } from "../scripts/plan";
import { meals, members, schedule } from "./fixtures";

test("compact files expand defaults and validate references without coupling names to IDs", () => {
  const plan = parsePlan(schedule, meals, members);
  assert.equal(plan.plan.length, 4);
  assert.deepEqual(plan.plan[0].people, ["member-a"]);
  assert.deepEqual(plan.plan[1].people, ["member-a", "member-b"]);
  assert.equal(plan.meals[0].recipeLink, "");
  const renamed = parsePlan(schedule, meals, {
    ...members,
    "member-a": { ...members["member-a"], name: "New name" },
  });
  assert.equal(renamed.names["member-a"], "New name");
  assert.deepEqual(renamed.plan, plan.plan);
  assert.deepEqual(renamed.avatars, plan.avatars);
  assert.equal(plan.avatars?.["member-b"], "/avatars/example.webp");
  assert.throws(() =>
    parsePlan(schedule, meals, {
      ...members,
      "member-a": { name: "Test", avatar: "/avatars/../secret" },
    })
  );
  for (const entry of [
    "unknown-meal",
    { meal: "first", members: ["unknown-member"] },
    { meal: "first", members: [] },
    { meal: "first", members: ["member-a", "member-a"] },
    [],
    ["first", "first"],
  ]) {
    assert.throws(() =>
      parsePlan(
        {
          ...schedule,
          Monday: { ...schedule.Monday, Breakfast: entry },
        },
        meals,
        members
      )
    );
  }
});

test("multiple meals form one selectable slot with separate members and combined groceries", () => {
  const plan = parsePlan(
    {
      ...schedule,
      Monday: {
        ...schedule.Monday,
        Breakfast: [
          { meal: "first", members: ["member-a"] },
          { meal: "second", members: ["member-b"] },
        ],
      },
    },
    meals,
    members
  );
  const groups = groupPlan(plan.plan);
  assert.equal(groups.length, 4);
  const [breakfast] = groups;
  assert.equal(breakfast.slot, "Breakfast");
  assert.deepEqual(
    breakfast.entries.map((e) => e.people),
    [["member-a"], ["member-b"]]
  );
  const selected = selectEntries([], breakfast.entries, true);
  assert.equal(selected.length, 2);
  assert.deepEqual(selectEntries(selected, breakfast.entries, false), []);
  const state = { ...plan, groceries: [], pantry: ["carrots"], version: 1 };
  const ingredients = ingredientsForEntries(plan.meals, breakfast.entries);
  const groceries = updateGroceries(state, ingredients, []);
  assert.deepEqual(groceries, ingredients);
  assert.deepEqual(updateGroceries({ groceries }, ingredients, []), groceries);
  assert.deepEqual(ingredients, ["rice", "Beans", "Carrots"]);
  assert.deepEqual(updateGroceries({ groceries }, [], groceries), []);
  const shared = mealShareText(state, breakfast.entries);
  assert.ok(shared.includes("Monday · Breakfast · Sam"));
  assert.ok(shared.includes("Monday · Breakfast · Ria"));
  assert.ok(shared.includes("First meal"));
  assert.ok(shared.includes("Second meal"));
  assert.deepEqual(
    groupPlan(plan.plan.toReversed()).map((g) => [g.day, g.slot]),
    groups.map((g) => [g.day, g.slot])
  );
});
