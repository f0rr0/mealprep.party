import { test } from "bun:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("Vercel migrates and syncs only production, stopping on either failure", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "mealprep-build-"));
  const script = new URL("../scripts/vercel-build.ts", import.meta.url)
    .pathname;
  const run = async (environment: string, failure?: "migrate" | "sync") => {
    await Bun.write(
      path.join(cwd, "package.json"),
      JSON.stringify({
        scripts: {
          "db:migrate": `bun -e 'console.log("migrated"); process.exit(${failure === "migrate" ? 1 : 0})'`,
          "plan:sync": `bun -e 'console.log("synced"); process.exit(${failure === "sync" ? 1 : 0})'`,
          build: "bun -e 'console.log(\"built\")'",
        },
      })
    );
    const child = Bun.spawn([process.execPath, script], {
      cwd,
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://localhost/test",
        DIRECT_URL: "postgresql://localhost/test",
        VERCEL_ENV: environment,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    return {
      output: await new Response(child.stdout).text(),
      code: await child.exited,
    };
  };
  try {
    assert.deepEqual(await run("production"), {
      output: "migrated\nsynced\nbuilt\n",
      code: 0,
    });
    assert.deepEqual(await run("preview"), { output: "built\n", code: 0 });
    assert.deepEqual(await run("development"), { output: "built\n", code: 0 });
    const migrationFailure = await run("production", "migrate");
    assert.notEqual(migrationFailure.code, 0);
    assert.equal(migrationFailure.output, "migrated\n");
    const syncFailure = await run("production", "sync");
    assert.notEqual(syncFailure.code, 0);
    assert.equal(syncFailure.output, "migrated\nsynced\n");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
