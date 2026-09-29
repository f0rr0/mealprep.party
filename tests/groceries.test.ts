import { test } from "bun:test";
import assert from "node:assert/strict";
import { setImmediate as settle } from "node:timers/promises";

import { createKitchenSync } from "@/lib/kitchen-sync";
import {
  ingredientsForEntries,
  missingIngredients,
  updateGroceries,
} from "@/lib/model";

import { createState } from "./fixtures";

test("groceries are ingredient snapshots: deduplicate, ignore checks, survive content edits and clear", () => {
  const state = createState();
  const wanted = ingredientsForEntries(state.meals, [state.plan[0]]);
  state.groceries = updateGroceries(state, wanted, []);
  state.pantry = wanted.map((name) => name.toLowerCase());
  assert.deepEqual(missingIngredients(wanted, state.groceries), []);
  assert.deepEqual(missingIngredients([" RICE ", "Dal"], ["rice"]), ["Dal"]);
  assert.deepEqual(
    updateGroceries({ groceries: ["Rice"] }, [" rice ", "DAL", "dal"], []),
    ["Rice", "DAL"]
  );
  state.meals = [];
  state.plan = [];
  assert.deepEqual(updateGroceries(state, [], []), wanted);
  assert.deepEqual(
    updateGroceries(
      state,
      [],
      wanted.map((name) => name.toUpperCase())
    ),
    []
  );
  assert.deepEqual(
    missingIngredients([...wanted, "New ingredient"], state.groceries),
    ["New ingredient"]
  );
});

test("optimistic grocery writes deduplicate, retry conflicts, preserve concurrent additions and clear checks", async () => {
  const initial = createState();
  initial.groceries = ["Rice"];
  initial.pantry = ["rice"];
  let server = structuredClone(initial);
  let shown = initial;
  let error = "";
  let offline = true;
  let conflict = true;
  const writes: { action: string; add: string[] }[] = [];
  const sync = createKitchenSync(
    initial,
    (next, message) => {
      shown = next;
      error = message;
    },
    async (_url, options) => {
      await settle();
      if (offline) {
        throw new Error("Offline");
      }
      if (options?.method !== "PATCH") {
        return Response.json(server);
      }
      const command = JSON.parse(String(options.body));
      writes.push(command);
      if (conflict) {
        conflict = false;
        server.groceries.push("Eggs");
        server.version += 1;
        return Response.json({}, { status: 409 });
      }
      assert.equal(command.version, server.version);
      const groceries = updateGroceries(server, command.add, command.remove);
      server = {
        ...server,
        groceries,
        pantry: server.pantry.filter((key) =>
          groceries.some((name) => name.toLowerCase() === key)
        ),
        version: server.version + 1,
      };
      return Response.json({
        version: server.version,
        groceries: server.groceries,
        pantry: server.pantry,
      });
    }
  );
  sync.setGroceries(["Dal", "Dal"], []);
  assert.deepEqual(shown.groceries, ["Rice", "Dal"]);
  assert.deepEqual(shown.pantry, ["rice"]);
  await settle();
  assert.ok(error);
  assert.equal(sync.hasPending(), true);
  offline = false;
  await sync.retry();
  assert.deepEqual(shown.groceries, ["Rice", "Eggs", "Dal"]);
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1].add, ["Dal"]);
  assert.equal(sync.hasPending(), false);
  assert.equal(error, "");
  assert.deepEqual(shown.meals, initial.meals);
  assert.deepEqual(shown.plan, initial.plan);
  sync.setGroceries([], shown.groceries);
  assert.deepEqual(shown.groceries, []);
  assert.deepEqual(shown.pantry, []);
  await settle();
  assert.deepEqual(server.groceries, []);
  sync.setGroceries(["Rice"], []);
  await settle();
  assert.deepEqual(shown.groceries, ["Rice"]);
  assert.deepEqual(shown.pantry, []);
});

test("checking a queued ingredient waits for its addition to persist", async () => {
  let server = createState();
  let shown = server;
  const gate = Promise.withResolvers<boolean>();
  const sync = createKitchenSync(
    server,
    (state) => {
      shown = state;
    },
    async (_url, options) => {
      await gate.promise;
      const command = JSON.parse(String(options?.body));
      if (command.action === "grocery-items") {
        server.groceries = updateGroceries(server, command.add, command.remove);
      } else {
        assert.ok(
          server.groceries.some(
            (name) => name.toLowerCase() === command.ingredient
          )
        );
        server.pantry.push(command.ingredient);
      }
      server = { ...server, version: server.version + 1 };
      return Response.json(server);
    }
  );
  sync.setGroceries(["Rice"], []);
  sync.setGroceries(["Dal"], []);
  sync.set("Dal", true);
  assert.deepEqual(shown.pantry, ["dal"]);
  gate.resolve(true);
  await settle();
  assert.deepEqual(server.groceries, ["Rice", "Dal"]);
  assert.deepEqual(server.pantry, ["dal"]);
  assert.equal(sync.hasPending(), false);
});
