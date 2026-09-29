import { test } from "bun:test";
import assert from "node:assert/strict";

import { claimPrompt } from "@/lib/prompts";

test("installation and notification prompts are independently shown once and skipped if preferences cannot be saved", () => {
  const saved = new Map<string, string>();
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value);
    },
  };
  assert.equal(claimPrompt("home-screen", storage), true);
  assert.equal(claimPrompt("home-screen", storage), false);
  assert.equal(claimPrompt("home-screen", { ...storage }), false);
  assert.equal(claimPrompt("notifications", storage), true);
  assert.equal(claimPrompt("notifications", { ...storage }), false);
  assert.equal(
    claimPrompt("notifications", {
      getItem: () => {
        throw new Error("Storage blocked");
      },
      setItem: storage.setItem,
    }),
    false
  );
  assert.equal(
    claimPrompt("notifications", {
      getItem: () => null,
      setItem: () => {
        throw new Error("Quota exceeded");
      },
    }),
    false
  );
});
