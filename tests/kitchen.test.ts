import { test } from "bun:test";
import assert from "node:assert/strict";

import { sameOrigin } from "@/lib/auth";
import {
  weekdayFor,
  weekdays,
  groceryText,
  ingredientsFor,
  kitchenCommand,
  mealSchema,
  planSchema,
  withNames,
} from "@/lib/model";

import { createState } from "./fixtures";

test("recurring weekday content, names, plain groceries and request boundaries", () => {
  const state = createState();
  assert.equal(state.plan.length, 28);
  assert.ok(Object.keys(state.names).length > 0);
  assert.equal(planSchema.safeParse(state).success, false);
  assert.equal(
    planSchema.safeParse({
      names: state.names,
      meals: state.meals,
      plan: state.plan,
    }).success,
    true
  );
  const [meal] = state.meals;
  assert.ok(meal);
  assert.deepEqual(Object.keys(meal).toSorted(), [
    "id",
    "ingredients",
    "recipe",
    "recipeLink",
    "title",
  ]);
  assert.equal(mealSchema.safeParse({ ...meal, minutes: 10 }).success, false);
  assert.equal(
    // oxlint-disable-next-line no-script-url -- Verify rejection of executable URLs.
    mealSchema.safeParse({ ...meal, recipeLink: "javascript:alert(1)" })
      .success,
    false
  );
  assert.equal(
    planSchema.safeParse({
      names: state.names,
      meals: state.meals,
      plan: [{ ...state.plan[0], mealId: "missing" }],
    }).success,
    false
  );
  assert.equal(
    kitchenCommand.safeParse({ action: "meal", meal, version: 1 }).success,
    false
  );
  assert.equal(
    withNames("{{member-a}} & {{member-b}}", {
      "member-a": "Sam",
      "member-b": "Ria",
    }),
    "Sam & Ria"
  );
  assert.equal(weekdayFor(new Date(2026, 8, 28)), "Monday");
  assert.equal(weekdayFor(new Date(2027, 0, 4)), "Monday");
  assert.equal(weekdayFor(new Date(2027, 0, 3)), "Sunday");
  for (const day of weekdays) {
    assert.equal(state.plan.filter((entry) => entry.day === day).length, 4);
  }
  assert.equal(
    planSchema.safeParse({
      names: state.names,
      meals: state.meals,
      plan: [{ ...state.plan[0], date: "2026-09-28" }],
    }).success,
    false
  );
  assert.deepEqual(
    ingredientsFor([
      { ...meal, ingredients: ["Rice", " Eggs "] },
      { ...meal, ingredients: ["rice", "Yogurt"] },
    ]),
    ["rice", "Eggs", "Yogurt"]
  );
  assert.equal(groceryText(["Rice", "Eggs"], ["eggs"]), "Rice");
  assert.equal(
    sameOrigin(
      new Request("https://kitchen.example/api/kitchen", {
        headers: { Origin: "https://elsewhere.example" },
      })
    ),
    false
  );
});

test("meal selections stay distinct across days; pantry checks survive rapid taps, conflicts and retry", async () => {
  const { entryKey, selectEntries } = await import("@/lib/model");
  const { createKitchenSync } = await import("@/lib/kitchen-sync");
  const { setImmediate: settle } = await import("node:timers/promises");
  const initial = createState();
  initial.pantry = [];
  const monday = initial.plan.filter((entry) => entry.day === "Monday");
  const tuesday = initial.plan.find((entry) => entry.day === "Tuesday");
  assert.ok(tuesday);
  let selected = selectEntries([], monday, true);
  selected = selectEntries(selected, [tuesday], true);
  selected = selectEntries(selected, [monday[0]], false);
  assert.equal(selected.length, 4);
  assert.ok(selected.includes(entryKey(tuesday)));
  assert.equal(selected.includes(entryKey(monday[0])), false);
  assert.equal(selectEntries(selected, monday, true).length, 5);

  let server = structuredClone(initial);
  let displayed = initial;
  let error = "";
  let offline = false;
  let conflict = false;
  let first = true;
  const gate = Promise.withResolvers<boolean>();
  const versions: number[] = [];
  const request: Parameters<typeof createKitchenSync>[2] = async (
    _url,
    options
  ) => {
    if (offline) {
      throw new Error("Offline");
    }
    if (options?.method !== "PATCH") {
      return Response.json(server);
    }
    if (first) {
      first = false;
      await gate.promise;
    }
    const command = JSON.parse(String(options.body));
    versions.push(command.version);
    if (conflict) {
      conflict = false;
      server = {
        ...server,
        version: server.version + 1,
        pantry: [...server.pantry, "dal"],
      };
      return Response.json({}, { status: 409 });
    }
    assert.equal(command.version, server.version);
    server = {
      ...server,
      version: server.version + 1,
      pantry: server.pantry.filter((key) => key !== command.ingredient),
    };
    if (command.checked) {
      server.pantry.push(command.ingredient);
    }
    return Response.json(server);
  };
  const sync = createKitchenSync(
    initial,
    (next, message) => {
      displayed = next;
      error = message;
    },
    request
  );
  sync.set("Rice", true);
  sync.set("Eggs", true);
  sync.set("rice", false);
  assert.deepEqual(displayed.pantry, ["eggs"]);
  assert.equal(server.version, initial.version);
  gate.resolve(true);
  await settle();
  assert.deepEqual(server.pantry, ["eggs"]);
  assert.deepEqual(displayed.pantry, ["eggs"]);
  assert.deepEqual(versions, [1, 2, 3]);
  assert.equal(sync.hasPending(), false);

  offline = true;
  sync.set("Eggs", false);
  await settle();
  assert.deepEqual(displayed.pantry, []);
  assert.ok(error);
  assert.equal(sync.hasPending(), true);
  offline = false;
  conflict = true;
  await sync.retry();
  assert.equal(error, "");
  assert.deepEqual(displayed.pantry, ["dal"]);
  assert.deepEqual(server.pantry, ["dal"]);
  assert.equal(sync.hasPending(), false);
});
