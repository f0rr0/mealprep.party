import { test } from "bun:test";
import assert from "node:assert/strict";

import { mealShareText, shareText } from "@/lib/share";

import { createState } from "./fixtures";

test("shares only selected meals in weekday order, with configured names and recipes", () => {
  const state = createState();
  const ids = Object.keys(state.names);
  state.names = Object.fromEntries(
    ids.map((id, index) => [id, ["Sam", "Ria"][index]])
  );
  const monday = state.plan.find(
    (entry) => entry.day === "Monday" && entry.slot === "Dinner"
  );
  const tuesday = state.plan.find(
    (entry) => entry.day === "Tuesday" && entry.slot === "Lunch"
  );
  assert.ok(monday && tuesday);
  const text = mealShareText(state, [tuesday, monday]);
  assert.ok(text.startsWith("Monday · Dinner · Sam & Ria"));
  assert.ok(text.includes("Tuesday · Lunch · Sam & Ria"));
  for (const entry of [monday, tuesday]) {
    const meal = state.meals.find((item) => item.id === entry.mealId);
    assert.ok(meal);
    assert.ok(text.includes(meal.title));
    assert.ok(text.includes(meal.recipe));
    assert.ok(text.includes(`• ${meal.ingredients[0]}`));
  }
  assert.equal(text.includes("Breakfast"), false);
  assert.equal(text.includes("localhost"), false);
  assert.equal(mealShareText(state, []), "");
});

test("native share, cancellation, clipboard fallback and blocked clipboard", async () => {
  const sent: ShareData[] = [];
  const copied: string[] = [];
  const clipboard = {
    writeText: (text: string) => {
      copied.push(text);
      return Promise.resolve();
    },
  };
  assert.equal(
    await shareText("Dinner", {
      share: (data) => {
        sent.push(data);
        return Promise.resolve();
      },
      clipboard,
    }),
    "shared"
  );
  assert.deepEqual(sent, [{ title: "Our kitchen", text: "Dinner" }]);
  assert.deepEqual(copied, []);
  assert.equal(
    await shareText("Dinner", {
      share: () => Promise.reject(new DOMException("Cancelled", "AbortError")),
      clipboard,
    }),
    "cancelled"
  );
  assert.deepEqual(copied, []);
  assert.equal(await shareText("Lunch", { clipboard }), "copied");
  assert.equal(
    await shareText("Snack", {
      share: () =>
        Promise.reject(new DOMException("Unavailable", "NotAllowedError")),
      clipboard,
    }),
    "copied"
  );
  assert.deepEqual(copied, ["Lunch", "Snack"]);
  assert.equal(
    await shareText("Dinner", {
      clipboard: {
        writeText: () => Promise.reject(new Error("Blocked")),
      },
    }),
    "manual"
  );
  assert.equal(await shareText("Dinner", {}), "manual");
});
