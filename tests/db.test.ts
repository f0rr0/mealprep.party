import { spyOn, test } from "bun:test";
import assert from "node:assert/strict";

import { db, readState } from "@/lib/db";

import { createState } from "./fixtures";

test("reads the saved kitchen in one query without seeding, including when missing", async () => {
  const state = createState();
  const query = spyOn(db.$client, "unsafe");
  try {
    query.mockReturnValue({
      values: () =>
        Promise.resolve([
          [
            7,
            state.groceries,
            state.pantry,
            state.names,
            state.avatars,
            state.meals,
            state.plan,
          ],
        ]),
    } as unknown as ReturnType<typeof db.$client.unsafe>);
    assert.deepEqual(await readState(), { ...state, version: 7 });
    assert.equal(query.mock.calls.length, 1);
    assert.match(query.mock.calls[0][0], /^select /iu);

    query.mockReturnValue({
      values: () => Promise.resolve([]),
    } as unknown as ReturnType<typeof db.$client.unsafe>);
    await assert.rejects(readState(), /Kitchen state is missing/u);
    assert.equal(query.mock.calls.length, 2);
    assert.match(query.mock.calls[1][0], /^select /iu);
  } finally {
    query.mockRestore();
  }
});
