import { test } from "bun:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";

test("haptics never inserts controls into links and cleans up vibration", async () => {
  const link = Object.assign(new EventTarget(), {
    tagName: "A",
    style: { position: "" },
    hasAttribute: () => false,
    matches: () => false,
    querySelector: () => null,
  });
  const vibrations: number[] = [];
  const build = await Bun.build({
    entrypoints: [new URL("../src/lib/haptics.ts", import.meta.url).pathname],
    target: "browser",
    format: "cjs",
  });
  assert.ok(build.success);
  const cleanup = runInNewContext(
    `${await build.outputs[0].text()}; module.exports.hapticRef(link);`,
    {
      link,
      module: { exports: {} },
      window: {},
      HTMLInputElement: class extends EventTarget {},
      navigator: {
        userAgent: "iPhone",
        vibrate: (duration: number) => vibrations.push(duration),
      },
      document: {
        createElement: () =>
          assert.fail("Interactive haptic overlays swallow link navigation"),
      },
    }
  );
  const click = new Event("click", { cancelable: true });
  assert.equal(link.dispatchEvent(click), true);
  assert.deepEqual(vibrations, [12]);
  cleanup();
  link.dispatchEvent(new Event("click"));
  assert.deepEqual(vibrations, [12]);
  assert.equal(link.style.position, "");
});
