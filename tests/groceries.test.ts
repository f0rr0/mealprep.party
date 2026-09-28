import { test } from "bun:test";
import assert from "node:assert/strict";
import { setImmediate as settle } from "node:timers/promises";

import { createKitchenSync } from "../lib/kitchen-sync";
import {
  entryKey,
  ingredientsForEntries,
  missingIngredients,
  updateGroceries,
} from "../lib/model";
import { seedState } from "../lib/seed";

test("groceries merge, deduplicate ingredients, ignore pantry and preserve concurrent additions", async () => {
  const initial = seedState();
  const [first, second, third] = initial.plan;
  const existing = entryKey(first);
  const added = entryKey(second);
  const concurrent = entryKey(third);
  initial.groceries = [existing];
  const ingredients = ingredientsForEntries(initial.meals, [first, second]);
  initial.pantry = ingredients.map((name) => name.toLowerCase());
  assert.equal(
    new Set(ingredients.map((name) => name.toLowerCase())).size,
    ingredients.length
  );
  assert.deepEqual(missingIngredients([" RICE ", "Dal"], ["rice"]), ["Dal"]);
  assert.deepEqual(missingIngredients(ingredients, ingredients), []);
  assert.ok(
    missingIngredients(
      ingredients,
      ingredientsForEntries(initial.meals, [first])
    ).length > 0
  );
  assert.deepEqual(updateGroceries(initial, [added, added, "invalid"], []), [
    existing,
    added,
  ]);
  assert.deepEqual(updateGroceries(initial, [], [existing]), []);

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
        server.groceries.push(concurrent);
        server.version += 1;
        return Response.json({}, { status: 409 });
      }
      assert.equal(command.version, server.version);
      server = {
        ...server,
        groceries: updateGroceries(server, command.add, command.remove),
        version: server.version + 1,
      };
      return Response.json(server);
    }
  );
  sync.setGroceries([added, added], []);
  assert.deepEqual(shown.groceries, [existing, added]);
  assert.deepEqual(shown.pantry, initial.pantry);
  await settle();
  assert.ok(error);
  assert.equal(sync.hasPending(), true);
  offline = false;
  await sync.retry();
  assert.deepEqual(shown.groceries, [existing, concurrent, added]);
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1].add, [added]);
  assert.equal(sync.hasPending(), false);
  assert.equal(error, "");

  sync.setGroceries([], [existing]);
  await settle();
  assert.deepEqual(server.groceries, [concurrent, added]);
});
