import { test } from "bun:test";
import assert from "node:assert/strict";

import {
  entryKey,
  groupPlan,
  ingredientsForEntries,
  selectEntries,
  updateGroceries,
} from "@/lib/model";
import { mealShareText } from "@/lib/share";

import meals from "../content/meals.json";
import members from "../content/members.json";
import schedule from "../content/plan.json";
import { parsePlan } from "../scripts/plan";

test("compact files expand defaults and validate references without coupling names to IDs", () => {
  const plan = parsePlan(schedule, meals, members);
  assert.equal(plan.plan.length, 28);
  assert.deepEqual(plan.plan[0].people, schedule.Monday.Breakfast.members);
  assert.deepEqual(plan.plan[1].people, Object.keys(members));
  assert.equal(plan.meals[0].recipeLink, "");
  const renamed = parsePlan(schedule, meals, {
    ...members,
    "member-1": { ...members["member-1"], name: "New name" },
  });
  assert.equal(renamed.names["member-1"], "New name");
  assert.deepEqual(renamed.plan, plan.plan);
  assert.deepEqual(renamed.avatars, plan.avatars);
  assert.equal(plan.avatars?.["member-2"], "/avatars/shreya.webp");
  assert.throws(() =>
    parsePlan(schedule, meals, {
      ...members,
      "member-1": { name: "Test", avatar: "/avatars/../secret" },
    })
  );
  for (const entry of [
    "unknown-meal",
    { meal: "0-breakfast", members: ["unknown-member"] },
    { meal: "0-breakfast", members: [] },
    { meal: "0-breakfast", members: ["member-1", "member-1"] },
    [],
    ["0-breakfast", "0-breakfast"],
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
          { meal: "0-breakfast", members: ["member-1"] },
          { meal: "juice", members: ["member-2"] },
        ],
      },
    },
    {
      ...meals,
      juice: {
        title: "Orange juice",
        recipe: "Squeeze oranges.",
        ingredients: ["Oranges", " eggs "],
      },
    },
    members
  );
  const groups = groupPlan(plan.plan);
  assert.equal(groups.length, 28);
  const [breakfast] = groups;
  assert.equal(breakfast.slot, "Breakfast");
  assert.deepEqual(
    breakfast.entries.map((e) => e.people),
    [["member-1"], ["member-2"]]
  );
  const selected = selectEntries([], breakfast.entries, true);
  assert.equal(selected.length, 2);
  assert.deepEqual(selectEntries(selected, breakfast.entries, false), []);
  const state = { ...plan, groceries: [], pantry: ["oranges"], version: 1 };
  const groceryKeys = updateGroceries(state, selected, []);
  assert.deepEqual(groceryKeys, selected);
  assert.deepEqual(
    updateGroceries({ ...state, groceries: groceryKeys }, selected, []),
    selected
  );
  const entries = plan.plan.filter((e) => groceryKeys.includes(entryKey(e)));
  const ingredients = ingredientsForEntries(plan.meals, entries);
  assert.ok(ingredients.includes("Oranges"));
  assert.ok(ingredients.includes("Whole-wheat bread"));
  assert.equal(ingredients.filter((i) => i.toLowerCase() === "eggs").length, 1);
  assert.deepEqual(
    updateGroceries({ ...state, groceries: groceryKeys }, [], selected),
    []
  );
  const shared = mealShareText(state, breakfast.entries);
  assert.ok(shared.includes("Monday · Breakfast · Sid"));
  assert.ok(shared.includes("Monday · Breakfast · Shreya"));
  assert.ok(shared.includes("Eggs & toast"));
  assert.ok(shared.includes("Orange juice"));
  assert.deepEqual(
    groupPlan(plan.plan.toReversed()).map((g) => [g.day, g.slot]),
    groups.map((g) => [g.day, g.slot])
  );
});
